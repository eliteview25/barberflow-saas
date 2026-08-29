const crypto=require('crypto');
const pool=require('../config/db');
const {normalizePhone}=require('../utils/security');
const {sendTemplate}=require('./whatsapp');

function round2(n){return Math.round(Number(n||0)*100)/100}
function code(prefix='BF'){return `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`}
function linkToken(){return crypto.randomBytes(12).toString('base64url')}

async function ensureMarketingSchema(db=pool){
  await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE`);
  await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in_em TIMESTAMP`);
  await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_out_em TIMESTAMP`);
  await db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marketing_opt_in_origem VARCHAR(40)`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_modelos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    template_nome_meta VARCHAR(512),
    idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',
    mensagem_preview TEXT,
    parametros JSONB NOT NULL DEFAULT '[]'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_cupons(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    codigo VARCHAR(40) NOT NULL,
    descricao VARCHAR(200),
    tipo VARCHAR(20) NOT NULL CHECK(tipo IN ('percentual','fixo')),
    valor NUMERIC(10,2) NOT NULL CHECK(valor>0),
    pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
    desconto_maximo NUMERIC(10,2),
    inicio TIMESTAMP,
    fim TIMESTAMP,
    limite_total INTEGER,
    limite_por_cliente INTEGER NOT NULL DEFAULT 1,
    usos INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(barbearia_id,codigo)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_campanhas(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    objetivo VARCHAR(80),
    segmento VARCHAR(40) NOT NULL DEFAULT 'todos',
    segmento_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    modelo_id BIGINT REFERENCES marketing_modelos(id) ON DELETE SET NULL,
    template_nome VARCHAR(512),
    template_idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',
    template_parametros JSONB NOT NULL DEFAULT '[]'::jsonb,
    mensagem_preview TEXT,
    cupom_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,
    link_destino VARCHAR(30),
    investimento NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    agendada_para TIMESTAMP,
    total_alvo INTEGER NOT NULL DEFAULT 0,
    enviados INTEGER NOT NULL DEFAULT 0,
    erros INTEGER NOT NULL DEFAULT 0,
    cliques INTEGER NOT NULL DEFAULT 0,
    conversoes INTEGER NOT NULL DEFAULT 0,
    receita NUMERIC(12,2) NOT NULL DEFAULT 0,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    enviado_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK(link_destino IS NULL OR link_destino IN ('agendamento','loja'))
  )`);
  await db.query(`ALTER TABLE marketing_campanhas ADD COLUMN IF NOT EXISTS link_destino VARCHAR(30)`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_envios(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    campanha_id BIGINT NOT NULL REFERENCES marketing_campanhas(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    telefone VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    provider_message_id TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    erro TEXT,
    enviado_em TIMESTAMP,
    entregue_em TIMESTAMP,
    lido_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(campanha_id,cliente_id)
  )`);
  for(const [col,type] of [
    ['provider_message_id','TEXT'],['tentativas','INTEGER NOT NULL DEFAULT 0'],['entregue_em','TIMESTAMP'],['lido_em','TIMESTAMP'],['atualizado_em','TIMESTAMP NOT NULL DEFAULT NOW()']
  ])await db.query(`ALTER TABLE marketing_envios ADD COLUMN IF NOT EXISTS ${col} ${type}`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_links(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    campanha_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL,
    nome VARCHAR(140) NOT NULL,
    token VARCHAR(80) NOT NULL UNIQUE,
    destino VARCHAR(30) NOT NULL CHECK(destino IN ('agendamento','loja')),
    cliques INTEGER NOT NULL DEFAULT 0,
    conversoes INTEGER NOT NULL DEFAULT 0,
    receita NUMERIC(12,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`ALTER TABLE marketing_campanhas ADD COLUMN IF NOT EXISTS marketing_link_id BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_cupom_usos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cupom_id BIGINT NOT NULL REFERENCES marketing_cupons(id) ON DELETE CASCADE,
    loja_pedido_id BIGINT REFERENCES loja_pedidos(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    telefone VARCHAR(40),
    valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(loja_pedido_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS marketing_indicacoes_config(
    barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT false,
    tipo_recompensa VARCHAR(20) NOT NULL DEFAULT 'fixo',
    valor_indicador NUMERIC(10,2) NOT NULL DEFAULT 10,
    valor_indicado NUMERIC(10,2) NOT NULL DEFAULT 10,
    pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS marketing_indicacao_codigos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(barbearia_id,cliente_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS marketing_indicacao_conversoes(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    codigo_id BIGINT NOT NULL REFERENCES marketing_indicacao_codigos(id) ON DELETE CASCADE,
    indicado_cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    loja_pedido_id BIGINT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
    cupom_indicador_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,
    cupom_indicado_id BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(barbearia_id,indicado_cliente_id),
    UNIQUE(loja_pedido_id)
  )`);

  const extra=[
    ['loja_pedidos','desconto','NUMERIC(10,2) NOT NULL DEFAULT 0'],
    ['loja_pedidos','cupom_id','BIGINT REFERENCES marketing_cupons(id) ON DELETE SET NULL'],
    ['loja_pedidos','cupom_codigo','VARCHAR(40)'],
    ['loja_pedidos','marketing_link_id','BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL'],
    ['loja_pedidos','marketing_campanha_id','BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL'],
    ['loja_pedidos','indicacao_codigo','VARCHAR(40)'],
    ['loja_pedidos','marketing_opt_in','BOOLEAN NOT NULL DEFAULT false'],
    ['agendamentos','marketing_link_id','BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL'],
    ['agendamentos','marketing_campanha_id','BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL'],
    ['reservas_pagamento','marketing_link_id','BIGINT REFERENCES marketing_links(id) ON DELETE SET NULL'],
    ['reservas_pagamento','marketing_campanha_id','BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL'],
    ['reservas_pagamento','marketing_opt_in','BOOLEAN NOT NULL DEFAULT false']
  ];
  for(const [table,col,type] of extra)await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);

  await db.query(`CREATE INDEX IF NOT EXISTS ix_marketing_campanhas_tenant ON marketing_campanhas(barbearia_id,status,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_marketing_envios_status ON marketing_envios(campanha_id,status)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_envio_provider_message ON marketing_envios(provider_message_id) WHERE provider_message_id IS NOT NULL`);
}

function segCfg(c={}){
  return {
    dias:Math.max(1,Math.min(3650,Number(c.dias||60))),
    valor_minimo:Math.max(0,Number(c.valor_minimo||500)),
    min_visitas:Math.max(1,Math.min(100,Number(c.min_visitas||3))),
    min_faltas:Math.max(1,Math.min(20,Number(c.min_faltas||2)))
  };
}

async function resolveAudience(barbeariaId,segmento='todos',config={},limit=1000){
  const c=segCfg(config);let having='',where=`c.barbearia_id=$1 AND c.marketing_opt_in=true`,vals=[barbeariaId];
  if(segmento==='aniversariantes')where+=` AND c.data_nascimento IS NOT NULL AND EXTRACT(MONTH FROM c.data_nascimento)=EXTRACT(MONTH FROM CURRENT_DATE)`;
  if(segmento==='novos')where+=` AND c.criado_em>=NOW()-INTERVAL '30 days'`;
  if(segmento==='inativos'){vals.push(c.dias);having=`HAVING MAX(a.data) FILTER(WHERE a.status='concluido') IS NOT NULL AND MAX(a.data) FILTER(WHERE a.status='concluido') < CURRENT_DATE-($2*INTERVAL '1 day')`;}
  if(segmento==='vip'){vals.push(c.valor_minimo);having=`HAVING (COALESCE(SUM(COALESCE(a.valor_final,a.valor_servico,0)) FILTER(WHERE a.status='concluido'),0)+COALESCE((SELECT SUM(lp.total) FROM loja_pedidos lp WHERE lp.barbearia_id=c.barbearia_id AND regexp_replace(lp.cliente_telefone,'\\D','','g')=regexp_replace(c.telefone,'\\D','','g') AND lp.status_pagamento='pago'),0)) >= $2`;}
  if(segmento==='frequentes'){vals.push(c.min_visitas);having=`HAVING COUNT(a.id) FILTER(WHERE a.status='concluido' AND a.data>=CURRENT_DATE-INTERVAL '90 days') >= $2`;}
  if(segmento==='faltosos'){vals.push(c.min_faltas);having=`HAVING COUNT(a.id) FILTER(WHERE a.status='nao_compareceu') >= $2`;}
  if(segmento==='compradores_loja')where+=` AND EXISTS(SELECT 1 FROM loja_pedidos lp WHERE lp.barbearia_id=c.barbearia_id AND regexp_replace(lp.cliente_telefone,'\\D','','g')=regexp_replace(c.telefone,'\\D','','g') AND lp.status_pagamento='pago')`;
  if(segmento==='carrinho_abandonado'){
    const days=Math.max(1,Math.min(90,Number(config.dias||7)));vals.push(days);
    where+=` AND EXISTS(SELECT 1 FROM loja_pedidos lp WHERE lp.barbearia_id=c.barbearia_id AND regexp_replace(lp.cliente_telefone,'\\D','','g')=regexp_replace(c.telefone,'\\D','','g') AND lp.status_pagamento IN ('expirado','recusado') AND lp.criado_em>=NOW()-($2*INTERVAL '1 day'))`;
  }
  const q=`SELECT c.id,c.nome,c.telefone,c.email,c.data_nascimento,
    COUNT(a.id) FILTER(WHERE a.status='concluido')::int visitas,
    (COALESCE(SUM(COALESCE(a.valor_final,a.valor_servico,0)) FILTER(WHERE a.status='concluido'),0)+COALESCE((SELECT SUM(lp.total) FROM loja_pedidos lp WHERE lp.barbearia_id=c.barbearia_id AND regexp_replace(lp.cliente_telefone,'\\D','','g')=regexp_replace(c.telefone,'\\D','','g') AND lp.status_pagamento='pago'),0))::numeric total_gasto,
    MAX(a.data) FILTER(WHERE a.status='concluido') ultima_visita
    FROM clientes c LEFT JOIN agendamentos a ON a.cliente_id=c.id AND a.barbearia_id=c.barbearia_id
    WHERE ${where} GROUP BY c.id ${having} ORDER BY c.nome LIMIT ${Math.max(1,Math.min(5000,Number(limit)||1000))}`;
  return (await pool.query(q,vals)).rows;
}

async function validateCoupon({barbeariaId,codigo,subtotal,telefone,clienteId=null}){
  const cd=String(codigo||'').trim().toUpperCase().slice(0,40);if(!cd)return {valid:false,discount:0};
  const x=(await pool.query(`SELECT * FROM marketing_cupons WHERE barbearia_id=$1 AND UPPER(codigo)=$2 AND ativo=true AND (inicio IS NULL OR inicio<=NOW()) AND (fim IS NULL OR fim>=NOW())`,[barbeariaId,cd])).rows[0];
  if(!x)return {valid:false,discount:0,error:'Cupom inválido ou expirado'};
  if(x.limite_total!=null&&Number(x.usos)>=Number(x.limite_total))return {valid:false,discount:0,error:'Cupom esgotado'};
  if(Number(subtotal)<Number(x.pedido_minimo||0))return {valid:false,discount:0,error:`Pedido mínimo para este cupom: R$ ${Number(x.pedido_minimo).toFixed(2).replace('.',',')}`};
  let cid=clienteId;if(!cid&&telefone){const p=normalizePhone(telefone);if(p)cid=(await pool.query(`SELECT id FROM clientes WHERE barbearia_id=$1 AND regexp_replace(telefone,'\\D','','g')=$2 LIMIT 1`,[barbeariaId,p])).rows[0]?.id||null;}
  if(x.cliente_id&&Number(x.cliente_id)!==Number(cid))return {valid:false,discount:0,error:'Este cupom é exclusivo para outro cliente'};
  if(cid&&x.limite_por_cliente){const n=Number((await pool.query(`SELECT COUNT(*) n FROM marketing_cupom_usos WHERE cupom_id=$1 AND cliente_id=$2`,[x.id,cid])).rows[0].n);if(n>=Number(x.limite_por_cliente))return {valid:false,discount:0,error:'Você já utilizou este cupom'};}
  let d=x.tipo==='percentual'?Number(subtotal)*Number(x.valor)/100:Number(x.valor);if(x.desconto_maximo!=null)d=Math.min(d,Number(x.desconto_maximo));d=round2(Math.max(0,Math.min(Number(subtotal),d)));
  return {valid:true,discount:d,coupon:x};
}

async function resolveMarketingLink(barbeariaId,tokenValue,destino){
  const t=String(tokenValue||'').trim().slice(0,80);if(!t)return null;
  return (await pool.query(`SELECT * FROM marketing_links WHERE barbearia_id=$1 AND token=$2 AND ativo=true AND ($3::text IS NULL OR destino=$3)`,[barbeariaId,t,destino||null])).rows[0]||null;
}
async function recordMarketingConversion(db,{linkId,campaignId,revenue=0}){
  if(linkId)await db.query(`UPDATE marketing_links SET conversoes=conversoes+1,receita=receita+$1 WHERE id=$2`,[round2(revenue),linkId]);
  if(campaignId)await db.query(`UPDATE marketing_campanhas SET conversoes=conversoes+1,receita=receita+$1,atualizado_em=NOW() WHERE id=$2`,[round2(revenue),campaignId]);
}
async function recordCouponUse(db,{barbeariaId,couponId,orderId,clientId,phone,discount}){
  if(!couponId)return;const r=await db.query(`INSERT INTO marketing_cupom_usos(barbearia_id,cupom_id,loja_pedido_id,cliente_id,telefone,valor_desconto) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(loja_pedido_id) DO NOTHING RETURNING id`,[barbeariaId,couponId,orderId,clientId,phone,discount]);
  if(r.rowCount)await db.query(`UPDATE marketing_cupons SET usos=usos+1,atualizado_em=NOW() WHERE id=$1`,[couponId]);
}

async function referralCode(barbeariaId,clientId){
  let r=await pool.query(`SELECT * FROM marketing_indicacao_codigos WHERE barbearia_id=$1 AND cliente_id=$2`,[barbeariaId,clientId]);if(r.rowCount)return r.rows[0];
  for(let i=0;i<5;i++){try{return (await pool.query(`INSERT INTO marketing_indicacao_codigos(barbearia_id,cliente_id,codigo) VALUES($1,$2,$3) RETURNING *`,[barbeariaId,clientId,code('IND')])).rows[0]}catch(e){if(e.code!=='23505')throw e}}
  throw new Error('Não foi possível gerar código');
}
async function resolveReferral(barbeariaId,codigo,phone){
  const c=String(codigo||'').trim().toUpperCase();if(!c)return null;
  const r=(await pool.query(`SELECT ic.*,cl.telefone indicador_telefone,cl.nome indicador_nome FROM marketing_indicacao_codigos ic JOIN clientes cl ON cl.id=ic.cliente_id AND cl.barbearia_id=ic.barbearia_id WHERE ic.barbearia_id=$1 AND ic.codigo=$2 AND ic.ativo=true`,[barbeariaId,c])).rows[0];
  if(!r)return null;if(normalizePhone(phone)&&normalizePhone(r.indicador_telefone)===normalizePhone(phone))throw Object.assign(new Error('Você não pode usar sua própria indicação'),{status:400});return r;
}
async function rewardCoupon(db,{barbeariaId,clientId,value,type,prefix}){
  if(!(Number(value)>0))return null;for(let i=0;i<5;i++){const cd=code(prefix);try{return (await db.query(`INSERT INTO marketing_cupons(barbearia_id,cliente_id,codigo,descricao,tipo,valor,limite_total,limite_por_cliente,ativo,fim) VALUES($1,$2,$3,$4,$5,$6,1,1,true,NOW()+INTERVAL '60 days') RETURNING id,codigo`,[barbeariaId,clientId,cd,'Recompensa de indicação',type,Number(value)])).rows[0]}catch(e){if(e.code!=='23505')throw e}}return null;
}
async function processReferralConversion(db,{order,clientId}){
  if(!order.indicacao_codigo||!clientId)return;const cfg=(await db.query(`SELECT * FROM marketing_indicacoes_config WHERE barbearia_id=$1 AND ativo=true`,[order.barbearia_id])).rows[0];if(!cfg||Number(order.total)<Number(cfg.pedido_minimo||0))return;
  const rc=(await db.query(`SELECT ic.* FROM marketing_indicacao_codigos ic WHERE ic.barbearia_id=$1 AND ic.codigo=$2 AND ic.ativo=true`,[order.barbearia_id,order.indicacao_codigo])).rows[0];if(!rc||Number(rc.cliente_id)===Number(clientId))return;
  const exists=await db.query(`SELECT 1 FROM marketing_indicacao_conversoes WHERE barbearia_id=$1 AND indicado_cliente_id=$2`,[order.barbearia_id,clientId]);if(exists.rowCount)return;
  const a=await rewardCoupon(db,{barbeariaId:order.barbearia_id,clientId:rc.cliente_id,value:cfg.valor_indicador,type:cfg.tipo_recompensa,prefix:'IND'});
  const b=await rewardCoupon(db,{barbeariaId:order.barbearia_id,clientId,value:cfg.valor_indicado,type:cfg.tipo_recompensa,prefix:'BEM'});
  await db.query(`INSERT INTO marketing_indicacao_conversoes(barbearia_id,codigo_id,indicado_cliente_id,loja_pedido_id,cupom_indicador_id,cupom_indicado_id) VALUES($1,$2,$3,$4,$5,$6)`,[order.barbearia_id,rc.id,clientId,order.id,a?.id||null,b?.id||null]);
}

function renderParam(s,{client,coupon,barbershop}){
  return String(s||'').replaceAll('{nome}',String(client.nome||'')).replaceAll('{cupom}',String(coupon?.codigo||'')).replaceAll('{barbearia}',String(barbershop||''));
}
async function ensureCampaignLink(camp){
  if(!camp.link_destino)return null;
  if(camp.marketing_link_id){const old=(await pool.query(`SELECT * FROM marketing_links WHERE id=$1 AND barbearia_id=$2`,[camp.marketing_link_id,camp.barbearia_id])).rows[0];if(old)return old;}
  for(let i=0;i<5;i++)try{
    const l=(await pool.query(`INSERT INTO marketing_links(barbearia_id,campanha_id,nome,token,destino) VALUES($1,$2,$3,$4,$5) RETURNING *`,[camp.barbearia_id,camp.id,`Campanha: ${String(camp.nome).slice(0,120)}`,linkToken(),camp.link_destino])).rows[0];
    await pool.query(`UPDATE marketing_campanhas SET marketing_link_id=$1 WHERE id=$2`,[l.id,camp.id]);return l;
  }catch(e){if(e.code!=='23505')throw e}
  throw new Error('Não foi possível criar link rastreável da campanha');
}

async function claimCampaignBatch(campaignId,limit=25){
  const db=await pool.connect();try{await db.query('BEGIN');const r=await db.query(`WITH picked AS (
    SELECT id FROM marketing_envios WHERE campanha_id=$1 AND (status='pendente' OR (status='processando' AND atualizado_em<NOW()-INTERVAL '10 minutes'))
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $2
  ) UPDATE marketing_envios e SET status='processando',tentativas=COALESCE(tentativas,0)+1,atualizado_em=NOW() FROM picked p WHERE e.id=p.id RETURNING e.*`,[campaignId,limit]);await db.query('COMMIT');return r.rows}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}

async function processMarketingCampaigns(limit=1){
  await ensureMarketingSchema();let processed=0;
  for(let n=0;n<limit;n++){
    const db=await pool.connect();let camp;
    try{
      await db.query('BEGIN');
      camp=(await db.query(`SELECT * FROM marketing_campanhas WHERE status IN ('agendada','enviando') AND COALESCE(agendada_para,NOW())<=NOW() ORDER BY agendada_para NULLS FIRST,id FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
      if(!camp){await db.query('COMMIT');break;}
      await db.query(`UPDATE marketing_campanhas SET status='enviando',atualizado_em=NOW() WHERE id=$1`,[camp.id]);
      const has=(await db.query(`SELECT 1 FROM marketing_envios WHERE campanha_id=$1 LIMIT 1`,[camp.id])).rowCount;
      if(!has){
        const audience=await resolveAudience(camp.barbearia_id,camp.segmento,camp.segmento_config,5000);
        for(const c of audience)await db.query(`INSERT INTO marketing_envios(barbearia_id,campanha_id,cliente_id,telefone) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[camp.barbearia_id,camp.id,c.id,normalizePhone(c.telefone)]);
        await db.query(`UPDATE marketing_campanhas SET total_alvo=$1 WHERE id=$2`,[audience.length,camp.id]);
      }
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}

    try{
      const integ=(await pool.query(`SELECT * FROM integracoes_whatsapp WHERE barbearia_id=$1 AND status='conectado'`,[camp.barbearia_id])).rows[0];if(!integ)throw new Error('WhatsApp oficial não conectado');
      if(!camp.template_nome)throw new Error('Template oficial não configurado');
      const bname=(await pool.query(`SELECT nome FROM barbearias WHERE id=$1`,[camp.barbearia_id])).rows[0]?.nome||'Barbearia';
      const cup=camp.cupom_id?(await pool.query(`SELECT codigo FROM marketing_cupons WHERE id=$1 AND barbearia_id=$2`,[camp.cupom_id,camp.barbearia_id])).rows[0]:null;
      const trackedLink=await ensureCampaignLink(camp);
      const claimed=await claimCampaignBatch(camp.id,25);
      for(const row of claimed){
        const r=(await pool.query(`SELECT e.*,c.nome FROM marketing_envios e LEFT JOIN clientes c ON c.id=e.cliente_id AND c.barbearia_id=e.barbearia_id WHERE e.id=$1`,[row.id])).rows[0];
        try{
          const params=(Array.isArray(camp.template_parametros)?camp.template_parametros:[]).map(x=>renderParam(x,{client:r,coupon:cup,barbershop:bname}));
          const sent=await sendTemplate(integ,r.telefone,camp.template_nome,params,camp.template_idioma||'pt_BR',{urlButtonParam:trackedLink?.token||null});
          const mid=sent?.messages?.[0]?.id||null;
          await pool.query(`UPDATE marketing_envios SET status='enviado',provider_message_id=$1,enviado_em=NOW(),atualizado_em=NOW(),erro=NULL WHERE id=$2`,[mid,r.id]);
          await pool.query(`UPDATE marketing_campanhas SET enviados=enviados+1 WHERE id=$1`,[camp.id]);
        }catch(e){
          if(Number(row.tentativas||0)>=3){await pool.query(`UPDATE marketing_envios SET status='erro',erro=$1,atualizado_em=NOW() WHERE id=$2`,[String(e.message).slice(0,500),r.id]);await pool.query(`UPDATE marketing_campanhas SET erros=erros+1 WHERE id=$1`,[camp.id]);}
          else await pool.query(`UPDATE marketing_envios SET status='pendente',erro=$1,atualizado_em=NOW() WHERE id=$2`,[String(e.message).slice(0,500),r.id]);
        }
      }
      const remaining=Number((await pool.query(`SELECT COUNT(*) n FROM marketing_envios WHERE campanha_id=$1 AND status IN ('pendente','processando')`,[camp.id])).rows[0].n);
      if(!remaining)await pool.query(`UPDATE marketing_campanhas SET status='enviada',enviado_em=NOW(),atualizado_em=NOW() WHERE id=$1`,[camp.id]);
      processed++;
    }catch(e){await pool.query(`UPDATE marketing_campanhas SET status='erro',atualizado_em=NOW() WHERE id=$1`,[camp.id]);console.error('marketing_campaign',camp.id,e.message);}
  }
  return processed;
}

async function updateWhatsAppMarketingStatus(providerMessageId,status,errors=[]){
  const id=String(providerMessageId||'').trim();if(!id)return false;const s=String(status||'').toLowerCase();
  const mapped=s==='read'?'lido':s==='delivered'?'entregue':s==='sent'?'enviado':s==='failed'?'erro':null;if(!mapped)return false;
  const err=Array.isArray(errors)&&errors.length?String(errors[0]?.title||errors[0]?.message||errors[0]?.code||'Falha no WhatsApp').slice(0,500):null;
  const r=await pool.query(`UPDATE marketing_envios SET status=$1,entregue_em=CASE WHEN $2 IN ('delivered','read') THEN COALESCE(entregue_em,NOW()) ELSE entregue_em END,lido_em=CASE WHEN $2='read' THEN COALESCE(lido_em,NOW()) ELSE lido_em END,erro=COALESCE($3,erro),atualizado_em=NOW() WHERE provider_message_id=$4 RETURNING id`,[mapped,s,err,id]);
  return !!r.rowCount;
}

module.exports={ensureMarketingSchema,resolveAudience,validateCoupon,resolveMarketingLink,recordMarketingConversion,recordCouponUse,referralCode,resolveReferral,processReferralConversion,processMarketingCampaigns,updateWhatsAppMarketingStatus};
