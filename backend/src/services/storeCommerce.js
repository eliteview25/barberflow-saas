const crypto=require('crypto');
const pool=require('../config/db');
const {externalSignal}=require('../utils/http');
const {decrypt}=require('./secrets');
const {normalizePhone,validEmail}=require('../utils/security');
const {cleanText,finiteMoney,intId}=require('../utils/validation');

const geoCache=new Map();let lastNominatim=0;
function round2(n){return Math.round(Number(n||0)*100)/100}
function token(){return crypto.randomBytes(24).toString('base64url')}
function safeOrderToken(v){const s=String(v||'').trim();return /^[A-Za-z0-9_-]{24,100}$/.test(s)?s:null}
function orderStatusLabel(s){return ({aguardando_pagamento:'Aguardando pagamento',confirmado:'Confirmado',preparando:'Preparando',pronto:'Pronto',saiu_entrega:'Saiu para entrega',concluido:'Concluído',cancelado:'Cancelado'})[s]||s}

async function ensureStoreCommerceSchema(db=pool){
  const cols=[
    ['loja_aceitar_retirada','BOOLEAN NOT NULL DEFAULT true'],['loja_aceitar_entrega','BOOLEAN NOT NULL DEFAULT false'],
    ['loja_retirada_instrucao','TEXT'],['loja_pedido_minimo','NUMERIC(10,2) NOT NULL DEFAULT 0'],
    ['loja_frete_taxa_base','NUMERIC(10,2) NOT NULL DEFAULT 0'],['loja_frete_por_km','NUMERIC(10,2) NOT NULL DEFAULT 2'],
    ['loja_frete_minimo','NUMERIC(10,2) NOT NULL DEFAULT 0'],['loja_frete_gratis_ate_km','NUMERIC(10,2)'],
    ['loja_frete_gratis_acima','NUMERIC(10,2)'],['loja_frete_distancia_max_km','NUMERIC(10,2) NOT NULL DEFAULT 20'],
    ['loja_aceitar_pix','BOOLEAN NOT NULL DEFAULT true'],['loja_aceitar_cartao','BOOLEAN NOT NULL DEFAULT true']
  ];
  for(const [c,t] of cols)await db.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS ${c} ${t}`);
  await db.query(`CREATE TABLE IF NOT EXISTS loja_pedidos(
    id BIGSERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    public_token TEXT NOT NULL UNIQUE,idempotency_key TEXT,cliente_nome VARCHAR(160) NOT NULL,cliente_email VARCHAR(160) NOT NULL,
    cliente_telefone VARCHAR(30) NOT NULL,tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'retirada',cep VARCHAR(12),endereco TEXT,numero VARCHAR(40),
    complemento VARCHAR(160),bairro VARCHAR(120),cidade VARCHAR(120),estado VARCHAR(40),distancia_km NUMERIC(10,2),subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    frete NUMERIC(10,2) NOT NULL DEFAULT 0,total NUMERIC(10,2) NOT NULL DEFAULT 0,forma_pagamento VARCHAR(20),status_pagamento VARCHAR(30) NOT NULL DEFAULT 'pendente',
    status_pedido VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',mp_payment_id TEXT,mp_status VARCHAR(40),qr_code TEXT,qr_code_base64 TEXT,ticket_url TEXT,
    estoque_reservado BOOLEAN NOT NULL DEFAULT true,venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,expira_em TIMESTAMP,criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    pago_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),UNIQUE(barbearia_id,idempotency_key))`);
  await db.query(`CREATE TABLE IF NOT EXISTS loja_pedido_itens(
    id BIGSERIAL PRIMARY KEY,pedido_id BIGINT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    nome VARCHAR(200) NOT NULL,imagem_url TEXT,quantidade INTEGER NOT NULL,valor_unitario NUMERIC(10,2) NOT NULL,subtotal NUMERIC(10,2) NOT NULL)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_loja_pedidos_tenant_status ON loja_pedidos(barbearia_id,status_pedido,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_loja_pedidos_expira ON loja_pedidos(status_pagamento,expira_em) WHERE status_pagamento='pendente'`);
}

async function storeTenantBySlug(slug){
  await ensureStoreCommerceSchema();
  const r=await pool.query(`SELECT b.*,a.plano,a.status assinatura_status,a.fim_trial,
    EXISTS(SELECT 1 FROM integracoes_pagamento ip WHERE ip.barbearia_id=b.id AND ip.provedor='mercadopago' AND ip.status='conectado' AND ip.access_token_enc IS NOT NULL AND ip.public_key IS NOT NULL) mp_conectado,
    (SELECT ip.public_key FROM integracoes_pagamento ip WHERE ip.barbearia_id=b.id AND ip.provedor='mercadopago' AND ip.status='conectado' LIMIT 1) mp_public_key
    FROM barbearias b JOIN LATERAL(SELECT plano,status,fim_trial FROM assinaturas x WHERE x.barbearia_id=b.id ORDER BY id DESC LIMIT 1)a ON true
    WHERE b.slug=$1 AND b.ativo=true AND b.excluido_em IS NULL AND COALESCE(b.loja_ativa,false)=true
      AND (a.status='ativa' OR (a.status='trial' AND a.fim_trial>=CURRENT_DATE))`,[String(slug||'').slice(0,120)]);
  const b=r.rows[0];if(!b||!['pro','premium'].includes(b.plano))return null;return b;
}

async function tenantMpCredentials(barbeariaId){
  const r=await pool.query(`SELECT access_token_enc,secret_enc,public_key,status FROM integracoes_pagamento WHERE barbearia_id=$1 AND provedor='mercadopago' LIMIT 1`,[barbeariaId]);
  const x=r.rows[0];if(!x||x.status!=='conectado'||!x.access_token_enc||!x.public_key)return {configured:false};
  let webhookReady=false;try{const sec=JSON.parse(decrypt(x.secret_enc)||'{}');webhookReady=String(sec.webhook_secret||'').trim().length>=16}catch{}return {configured:true,accessToken:decrypt(x.access_token_enc),publicKey:x.public_key,webhookReady};
}

function fullAddress(x){return [x.endereco,x.numero,x.bairro,x.cidade,x.estado,x.cep,'Brasil'].filter(Boolean).map(v=>String(v).trim()).filter(Boolean).join(', ')}
function originAddress(b){return [b.endereco,b.cidade,b.estado,'Brasil'].filter(Boolean).join(', ')}
async function googleDistance(origin,destination,key){
  const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration'},body:JSON.stringify({origin:{address:origin},destination:{address:destination},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',languageCode:'pt-BR',regionCode:'BR',units:'METRIC'}),signal:externalSignal()});
  let d={};try{d=await r.json()}catch{}if(!r.ok||!d.routes?.[0]?.distanceMeters)throw new Error(d.error?.message||'Não foi possível calcular a rota');return {km:round2(Number(d.routes[0].distanceMeters)/1000),provider:'google',duration:d.routes[0].duration||null};
}
async function throttleNominatim(){const wait=Math.max(0,1050-(Date.now()-lastNominatim));if(wait)await new Promise(r=>setTimeout(r,wait));lastNominatim=Date.now()}
async function geocodeOsm(address){const key=String(address).toLowerCase();const hit=geoCache.get(key);if(hit&&Date.now()-hit.at<24*3600e3)return hit.value;await throttleNominatim();const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('format','jsonv2');u.searchParams.set('limit','1');u.searchParams.set('countrycodes','br');u.searchParams.set('q',address);const r=await fetch(u,{headers:{'User-Agent':`BarberFlow/2.7 (${process.env.APP_URL||'https://barberflow.app'})`,'Accept-Language':'pt-BR'},signal:externalSignal()});const d=await r.json();if(!r.ok||!Array.isArray(d)||!d[0])throw new Error('Endereço não localizado para entrega');const value={lat:Number(d[0].lat),lon:Number(d[0].lon)};geoCache.set(key,{at:Date.now(),value});return value}
async function osmDistance(origin,destination){const [a,b]=await Promise.all([geocodeOsm(origin),geocodeOsm(destination)]);const u=`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;const r=await fetch(u,{headers:{'User-Agent':`BarberFlow/2.7 (${process.env.APP_URL||'https://barberflow.app'})`},signal:externalSignal()});const d=await r.json();if(!r.ok||d.code!=='Ok'||!d.routes?.[0]?.distance)throw new Error('Não foi possível calcular a distância de entrega');return {km:round2(Number(d.routes[0].distance)/1000),provider:'osm',duration:d.routes[0].duration?`${Math.ceil(d.routes[0].duration/60)} min`:null}}
async function routeDistance(origin,destination){const key=process.env.GOOGLE_MAPS_ROUTES_API_KEY||process.env.GOOGLE_MAPS_API_KEY;if(key){try{return await googleDistance(origin,destination,key)}catch(e){if(process.env.ROUTING_FALLBACK_OSM==='false')throw e;}}return osmDistance(origin,destination)}

function shippingConfig(b){return {aceitar_retirada:b.loja_aceitar_retirada!==false,aceitar_entrega:b.loja_aceitar_entrega===true,retirada_instrucao:b.loja_retirada_instrucao||'',pedido_minimo:Number(b.loja_pedido_minimo||0),taxa_base:Number(b.loja_frete_taxa_base||0),valor_por_km:Number(b.loja_frete_por_km||0),frete_minimo:Number(b.loja_frete_minimo||0),gratis_ate_km:b.loja_frete_gratis_ate_km==null?null:Number(b.loja_frete_gratis_ate_km),gratis_acima:b.loja_frete_gratis_acima==null?null:Number(b.loja_frete_gratis_acima),distancia_max_km:Number(b.loja_frete_distancia_max_km||20),aceitar_pix:b.loja_aceitar_pix!==false,aceitar_cartao:b.loja_aceitar_cartao!==false}}
async function quoteShipping(b,{tipo_entrega,endereco,subtotal}){
  const cfg=shippingConfig(b);if(tipo_entrega==='retirada'){if(!cfg.aceitar_retirada)throw new Error('Retirada não disponível');return {tipo:'retirada',distancia_km:0,frete:0,provider:null}}
  if(tipo_entrega!=='entrega'||!cfg.aceitar_entrega)throw new Error('Entrega não disponível');const origin=originAddress(b),dest=fullAddress(endereco||{});if(!origin||origin.split(',').length<3)throw new Error('A barbearia precisa configurar endereço, cidade e UF antes de oferecer entrega');if(!endereco?.endereco||!endereco?.numero||!endereco?.cidade||!endereco?.estado||!endereco?.cep)throw new Error('Preencha CEP, endereço, número, cidade e UF para entrega');const route=await routeDistance(origin,dest);if(route.km>cfg.distancia_max_km+0.001)throw new Error(`Entrega disponível em até ${cfg.distancia_max_km.toLocaleString('pt-BR')} km`);let frete=Math.max(cfg.frete_minimo,cfg.taxa_base+route.km*cfg.valor_por_km);if((cfg.gratis_ate_km!=null&&route.km<=cfg.gratis_ate_km)||(cfg.gratis_acima!=null&&subtotal>=cfg.gratis_acima))frete=0;return {tipo:'entrega',distancia_km:route.km,frete:round2(frete),provider:route.provider,duration:route.duration}}

async function releaseOrderStock(db,orderId){const o=(await db.query(`SELECT estoque_reservado FROM loja_pedidos WHERE id=$1 FOR UPDATE`,[orderId])).rows[0];if(!o?.estoque_reservado)return false;const items=(await db.query(`SELECT produto_id,quantidade FROM loja_pedido_itens WHERE pedido_id=$1`,[orderId])).rows;for(const it of items)if(it.produto_id)await db.query(`UPDATE produtos SET estoque=estoque+$1,atualizado_em=NOW() WHERE id=$2`,[it.quantidade,it.produto_id]);await db.query(`UPDATE loja_pedidos SET estoque_reservado=false,atualizado_em=NOW() WHERE id=$1`,[orderId]);return true}
async function releaseExpiredStoreOrders(){await ensureStoreCommerceSchema();const db=await pool.connect();let n=0;try{await db.query('BEGIN');const rows=await db.query(`SELECT id FROM loja_pedidos WHERE status_pagamento='pendente' AND estoque_reservado=true AND expira_em<NOW() FOR UPDATE SKIP LOCKED`);for(const x of rows.rows){await releaseOrderStock(db,x.id);await db.query(`UPDATE loja_pedidos SET status_pagamento='expirado',status_pedido='cancelado',atualizado_em=NOW() WHERE id=$1`,[x.id]);n++}await db.query('COMMIT');return n}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}

async function createOrder({slug,body}){
  const b=await storeTenantBySlug(slug);if(!b)throw Object.assign(new Error('Loja não disponível'),{status:404});const cfg=shippingConfig(b);if(!b.mp_conectado)throw Object.assign(new Error('Pagamento online da loja ainda não foi configurado pela barbearia'),{status:503});
  const nome=cleanText(body?.nome,160,{required:true}),email=String(body?.email||'').trim().toLowerCase(),telefone=normalizePhone(body?.telefone);if(!nome||!validEmail(email)||telefone.length<10)throw Object.assign(new Error('Informe nome, e-mail e WhatsApp válidos'),{status:400});
  const items=Array.isArray(body?.itens)?body.itens.slice(0,30):[];if(!items.length)throw Object.assign(new Error('Carrinho vazio'),{status:400});const normalized=[];for(const x of items){const id=intId(x.id),q=Number(x.quantidade);if(!id||!Number.isInteger(q)||q<1||q>99)throw Object.assign(new Error('Item do carrinho inválido'),{status:400});normalized.push({id,q})}
  const ids=[...new Set(normalized.map(x=>x.id))];const products=(await pool.query(`SELECT id,nome,preco,estoque,imagem_url FROM produtos WHERE barbearia_id=$1 AND ativo=true AND COALESCE(mostrar_na_loja,false)=true AND id=ANY($2::int[])`,[b.id,ids])).rows;const by=new Map(products.map(x=>[x.id,x]));if(by.size!==ids.length)throw Object.assign(new Error('Um produto do carrinho não está mais disponível'),{status:409});let subtotal=0;for(const x of normalized){const p=by.get(x.id);if(Number(p.estoque)<x.q)throw Object.assign(new Error(`${p.nome}: estoque insuficiente`),{status:409});subtotal+=Number(p.preco)*x.q}subtotal=round2(subtotal);if(subtotal<cfg.pedido_minimo)throw Object.assign(new Error(`Pedido mínimo: ${cfg.pedido_minimo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`),{status:400});
  const shipping=await quoteShipping(b,{tipo_entrega:String(body?.tipo_entrega||'retirada'),endereco:body?.endereco||{},subtotal});const total=round2(subtotal+shipping.frete);const idem=cleanText(body?.idempotency_key,100)||crypto.randomUUID();const db=await pool.connect();try{await db.query('BEGIN');const existing=await db.query(`SELECT public_token FROM loja_pedidos WHERE barbearia_id=$1 AND idempotency_key=$2`,[b.id,idem]);if(existing.rowCount){await db.query('COMMIT');return getOrderByToken(b.id,existing.rows[0].public_token)}
    for(const x of normalized){const p=(await db.query(`SELECT id,nome,preco,estoque,imagem_url FROM produtos WHERE id=$1 AND barbearia_id=$2 AND ativo=true AND COALESCE(mostrar_na_loja,false)=true FOR UPDATE`,[x.id,b.id])).rows[0];if(!p||Number(p.estoque)<x.q)throw Object.assign(new Error(`${p?.nome||'Produto'}: estoque insuficiente`),{status:409})}
    const pub=token(),addr=body?.endereco||{};const o=(await db.query(`INSERT INTO loja_pedidos(barbearia_id,public_token,idempotency_key,cliente_nome,cliente_email,cliente_telefone,tipo_entrega,cep,endereco,numero,complemento,bairro,cidade,estado,distancia_km,subtotal,frete,total,expira_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()+INTERVAL '30 minutes') RETURNING *`,[b.id,pub,idem,nome,email,telefone,shipping.tipo,cleanText(addr.cep,12)||null,cleanText(addr.endereco,300)||null,cleanText(addr.numero,40)||null,cleanText(addr.complemento,160)||null,cleanText(addr.bairro,120)||null,cleanText(addr.cidade,120)||null,cleanText(addr.estado,40)||null,shipping.distancia_km,subtotal,shipping.frete,total])).rows[0];
    for(const x of normalized){const p=(await db.query(`SELECT id,nome,preco,imagem_url FROM produtos WHERE id=$1 AND barbearia_id=$2`,[x.id,b.id])).rows[0],sub=round2(Number(p.preco)*x.q);await db.query(`INSERT INTO loja_pedido_itens(pedido_id,produto_id,nome,imagem_url,quantidade,valor_unitario,subtotal) VALUES($1,$2,$3,$4,$5,$6,$7)`,[o.id,p.id,p.nome,p.imagem_url,x.q,p.preco,sub]);await db.query(`UPDATE produtos SET estoque=estoque-$1,atualizado_em=NOW() WHERE id=$2 AND barbearia_id=$3`,[x.q,p.id,b.id])}
    await db.query('COMMIT');return {...o,shipping,config:{aceitar_pix:cfg.aceitar_pix,aceitar_cartao:cfg.aceitar_cartao},public_key:b.mp_public_key};
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}

async function getOrderByToken(barbeariaId,publicToken){const t=safeOrderToken(publicToken);if(!t)return null;const o=(await pool.query(`SELECT * FROM loja_pedidos WHERE barbearia_id=$1 AND public_token=$2`,[barbeariaId,t])).rows[0];if(!o)return null;const itens=(await pool.query(`SELECT produto_id,nome,imagem_url,quantidade,valor_unitario,subtotal FROM loja_pedido_itens WHERE pedido_id=$1 ORDER BY id`,[o.id])).rows;return {...o,itens,status_label:orderStatusLabel(o.status_pedido)}}

async function markOrderPayment(orderId,payment){const db=await pool.connect();try{await db.query('BEGIN');const o=(await db.query(`SELECT * FROM loja_pedidos WHERE id=$1 FOR UPDATE`,[orderId])).rows[0];if(!o){await db.query('ROLLBACK');throw new Error('Pedido não encontrado')}const ref=String(payment?.external_reference||'');if(ref!==`barberflow-store:${o.id}`)throw new Error('Pagamento não pertence ao pedido');const amount=Number(payment.transaction_amount??payment.transaction_details?.total_paid_amount??0);if(payment.status==='approved'&&Math.abs(amount-Number(o.total))>0.011)throw new Error('Valor pago não corresponde ao pedido');const mpStatus=String(payment.status||'unknown'),pid=String(payment.id||'');if(mpStatus==='approved'){
      if(o.status_pagamento==='pago'){await db.query('COMMIT');return o}
      const used=await db.query(`SELECT id FROM loja_pedidos WHERE mp_payment_id=$1 AND id<>$2 LIMIT 1`,[pid,o.id]);if(used.rowCount)throw new Error('Pagamento já vinculado a outro pedido');const items=(await db.query(`SELECT * FROM loja_pedido_itens WHERE pedido_id=$1`,[o.id])).rows;let vendaId=o.venda_id;if(!vendaId){let clienteId=null;try{const phone=normalizePhone(o.cliente_telefone);const found=await db.query(`SELECT id FROM clientes WHERE barbearia_id=$1 AND telefone=$2 ORDER BY id LIMIT 1`,[o.barbearia_id,phone]);if(found.rowCount)clienteId=found.rows[0].id;else clienteId=(await db.query(`INSERT INTO clientes(barbearia_id,nome,telefone,email) VALUES($1,$2,$3,$4) RETURNING id`,[o.barbearia_id,o.cliente_nome,phone,o.cliente_email])).rows[0].id}catch{}
        const forma=String(payment.payment_method_id||'').toLowerCase()==='pix'?'pix':'cartao';const vr=await db.query(`INSERT INTO vendas(barbearia_id,cliente_id,forma_pagamento,status,total,desconto,subtotal_servicos,subtotal_produtos,valor_pre_pago,valor_recebido) VALUES($1,$2,$3,'finalizada',$4,0,0,$5,0,$4) RETURNING id`,[o.barbearia_id,clienteId,forma,o.total,o.subtotal]);vendaId=vr.rows[0].id;for(const it of items)await db.query(`INSERT INTO venda_itens(venda_id,tipo,referencia_id,descricao,quantidade,valor_unitario,subtotal) VALUES($1,'produto',$2,$3,$4,$5,$6)`,[vendaId,it.produto_id,it.nome,it.quantidade,it.valor_unitario,it.subtotal]);}
      await db.query(`UPDATE loja_pedidos SET status_pagamento='pago',status_pedido='confirmado',mp_payment_id=$1,mp_status=$2,estoque_reservado=false,venda_id=$3,pago_em=NOW(),atualizado_em=NOW() WHERE id=$4`,[pid,mpStatus,vendaId,o.id]);
    }else if(['rejected','cancelled','refunded','charged_back'].includes(mpStatus)){if(o.status_pagamento!=='pago')await releaseOrderStock(db,o.id);await db.query(`UPDATE loja_pedidos SET status_pagamento=$1,status_pedido=CASE WHEN status_pagamento='pago' THEN status_pedido ELSE 'cancelado' END,mp_payment_id=$2,mp_status=$3,atualizado_em=NOW() WHERE id=$4`,[mpStatus==='refunded'?'reembolsado':'recusado',pid,mpStatus,o.id]);}
    else await db.query(`UPDATE loja_pedidos SET mp_payment_id=$1,mp_status=$2,atualizado_em=NOW() WHERE id=$3`,[pid,mpStatus,o.id]);await db.query('COMMIT');return getOrderByToken(o.barbearia_id,o.public_token)
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}

module.exports={ensureStoreCommerceSchema,storeTenantBySlug,tenantMpCredentials,shippingConfig,quoteShipping,createOrder,getOrderByToken,markOrderPayment,releaseExpiredStoreOrders,releaseOrderStock,safeOrderToken,fullAddress};
