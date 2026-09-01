const pool=require('../config/db');
const {encrypt,decrypt}=require('./secrets');
const {PROVIDERS,credentialsFor}=require('./paymentGateways');
const {externalSignal}=require('../utils/http');

async function ensurePlatformPaymentGatewaySchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS platform_payment_gateways(
    provedor VARCHAR(40) PRIMARY KEY,
    secret_enc TEXT,
    public_key TEXT,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    status VARCHAR(30) NOT NULL DEFAULT 'sem_credenciais',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
}

function mercadoPagoCredentialEnvironment(value){const v=String(value||'').trim();if(/^TEST-/i.test(v))return 'sandbox';if(/^APP_USR-/i.test(v))return 'production';return null;}

async function verifyMercadoPagoAccessToken(token){
  const r=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${token}`},signal:externalSignal()});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){const e=new Error('Access Token do Mercado Pago não foi aceito');e.status=400;throw e;}
  return {provider_account_id:String(d.id||''),nickname:String(d.nickname||'').slice(0,120),email:String(d.email||'').slice(0,180),site_id:String(d.site_id||'').slice(0,20)};
}

async function inspectMercadoPagoCapabilities(token){
  const r=await fetch('https://api.mercadopago.com/v1/payment_methods',{headers:{Authorization:`Bearer ${token}`},signal:externalSignal()});
  let d=[];try{d=await r.json()}catch{}
  if(!r.ok){console.error('platform_mp_capabilities',{status:r.status});return {checked:false,pix_available:null,credit_card_available:null,error:'Não foi possível consultar os meios de pagamento'}};
  const methods=Array.isArray(d)?d:[];
  const enabled=m=>!['inactive','disabled','unavailable'].includes(String(m?.status||'').toLowerCase());
  const pix=methods.find(m=>m?.id==='pix'&&enabled(m));
  const cards=methods.filter(m=>m?.payment_type_id==='credit_card'&&enabled(m));
  return {checked:true,pix_available:!!pix,credit_card_available:cards.length>0,pix_status:pix?String(pix.status||'active'):null,credit_card_methods:cards.map(x=>String(x.id||'')).filter(Boolean).slice(0,12)};
}

async function diagnosePlatformMercadoPago(){
  const c=await getPlatformGatewayCredentials('mercadopago');
  const accessToken=String(c.secret?.access_token||'').trim();const publicKey=String(c.publicKey||'').trim();
  if(!accessToken)return {configured:false,checked:false,pix_available:null,credit_card_available:null,key_environment_match:null};
  const tokenEnv=mercadoPagoCredentialEnvironment(accessToken),keyEnv=mercadoPagoCredentialEnvironment(publicKey);
  const caps=await inspectMercadoPagoCapabilities(accessToken);
  const siteId=String(c.metadata?.site_id||'');const diag={configured:true,...caps,environment:tokenEnv||c.environment||'production',site_id:siteId||null,brazil_account:siteId?siteId==='MLB':null,key_environment_match:!publicKey||!tokenEnv||!keyEnv?null:tokenEnv===keyEnv};
  if(caps.checked)await pool.query(`UPDATE platform_payment_gateways SET metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb,atualizado_em=NOW() WHERE provedor='mercadopago'`,[JSON.stringify({checked:true,pix_available:caps.pix_available,credit_card_available:caps.credit_card_available,pix_status:caps.pix_status||null,credit_card_methods:caps.credit_card_methods||[]})]).catch(()=>{});
  return diag;
}

async function savePlatformGatewayCredentials(userId,provedor,raw){
  if(!PROVIDERS[provedor]){const e=new Error('Gateway inválido');e.status=404;throw e;}
  if(!process.env.APP_SECRETS_ENCRYPTION_KEY)throw new Error('Criptografia de segredos não configurada no servidor');
  const c=credentialsFor(provedor,raw);
  let verified={};
  if(provedor==='mercadopago'){
    const tokenEnv=mercadoPagoCredentialEnvironment(c.accessToken),keyEnv=mercadoPagoCredentialEnvironment(c.publicKey);
    if(tokenEnv&&keyEnv&&tokenEnv!==keyEnv){const e=new Error('Access Token e Public Key do Mercado Pago pertencem a ambientes diferentes. Use as duas credenciais de Produção ou as duas de Teste.');e.status=400;throw e;}
    verified={...(await verifyMercadoPagoAccessToken(c.accessToken)),...(await inspectMercadoPagoCapabilities(c.accessToken))};
    const atual=(await pool.query(`SELECT metadata,status FROM platform_payment_gateways WHERE provedor='mercadopago' LIMIT 1`)).rows[0];
    const currentAccount=String(atual?.metadata?.provider_account_id||'');
    const nextAccount=String(verified.provider_account_id||'');
    if(currentAccount&&nextAccount&&currentAccount!==nextAccount){
      const active=Number((await pool.query(`SELECT COUNT(*)::int n FROM assinaturas WHERE provedor='mercadopago' AND referencia_externa IS NOT NULL AND status<>'cancelada' AND COALESCE(provedor_status,'') IN ('authorized','pending','paused')`)).rows[0]?.n||0);
      if(active>0){const e=new Error(`Esta conta Mercado Pago recebe ${active} assinatura(s) recorrente(s) ativa(s). Para trocar para outra conta, cancele ou migre essas assinaturas primeiro.`);e.status=409;throw e;}
    }
  }
  const secretEnc=encrypt(JSON.stringify(c.secret));
  const status='credenciais_salvas';
  const metadata={credential_fields:Object.keys(c.secret).concat(c.publicKey?['public_key']:[]),source:'supermaster',subscription_receiver:provedor==='mercadopago',...verified};
  await pool.query(`INSERT INTO platform_payment_gateways(provedor,secret_enc,public_key,environment,status,metadata,atualizado_por,atualizado_em)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,NOW())
    ON CONFLICT(provedor) DO UPDATE SET secret_enc=EXCLUDED.secret_enc,public_key=EXCLUDED.public_key,environment=EXCLUDED.environment,status=EXCLUDED.status,metadata=EXCLUDED.metadata,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=NOW()`,[
      provedor,secretEnc,c.publicKey||null,c.environment,status,JSON.stringify(metadata),userId
    ]);
  return {provedor,status,ambiente:c.environment,credenciais_salvas:true,verificado:provedor==='mercadopago',recebe_assinaturas:provedor==='mercadopago'};
}

async function listPlatformGateways(){
  await ensurePlatformPaymentGatewaySchema();
  const r=await pool.query(`SELECT provedor,public_key,environment,status,metadata,atualizado_em FROM platform_payment_gateways`);
  const by=new Map(r.rows.map(x=>[x.provedor,x]));
  return Object.values(PROVIDERS).map(p=>{const x=by.get(p.id)||{},connected=x.status==='credenciais_salvas',meta=x.metadata||{};return {...p,descricao:p.id==='mercadopago'?'Conta central da plataforma. Todos os pagamentos Starter, Pro e Premium por Pix/cartão são recebidos nesta conta.':p.descricao,credenciais_salvas:connected,status:x.status||'sem_credenciais',ambiente:x.environment||'production',atualizado_em:x.atualizado_em||null,verificado:p.id==='mercadopago'&&connected&&!!meta.provider_account_id,recebe_assinaturas:p.id==='mercadopago'&&connected,diagnostico:p.id==='mercadopago'&&connected?{checked:meta.checked===true,pix_available:meta.pix_available??null,credit_card_available:meta.credit_card_available??null,key_environment_match:true}:null,conta_recebedora:p.id==='mercadopago'&&connected?{id:String(meta.provider_account_id||''),nome:String(meta.nickname||'').slice(0,120),email:String(meta.email||'').slice(0,180)}:null};});
}

async function disconnectPlatformGateway(provedor){
  if(!PROVIDERS[provedor]){const e=new Error('Gateway inválido');e.status=404;throw e;}
  if(provedor==='mercadopago'){
    const active=Number((await pool.query(`SELECT COUNT(*)::int n FROM assinaturas WHERE provedor='mercadopago' AND referencia_externa IS NOT NULL AND status<>'cancelada' AND COALESCE(provedor_status,'') IN ('authorized','pending','paused')`)).rows[0]?.n||0);
    if(active>0){const e=new Error(`Não é possível remover a conta recebedora enquanto existem ${active} assinatura(s) recorrente(s) ativa(s).`);e.status=409;throw e;}
  }
  await pool.query(`UPDATE platform_payment_gateways SET secret_enc=NULL,public_key=NULL,status='sem_credenciais',metadata='{}'::jsonb,atualizado_em=NOW() WHERE provedor=$1`,[provedor]);
}

async function getPlatformGatewayCredentials(provedor){
  await ensurePlatformPaymentGatewaySchema();
  const r=await pool.query(`SELECT secret_enc,public_key,environment,status,metadata FROM platform_payment_gateways WHERE provedor=$1 LIMIT 1`,[provedor]);
  if(r.rowCount&&r.rows[0].secret_enc&&r.rows[0].status==='credenciais_salvas'){
    try{return {secret:JSON.parse(decrypt(r.rows[0].secret_enc)),publicKey:r.rows[0].public_key||null,environment:r.rows[0].environment||'production',metadata:r.rows[0].metadata||{},source:'database'};}catch(e){console.error('platform_gateway_decrypt_failed',{provedor,message:e.message});}
  }
  const legacyAllowed=process.env.ALLOW_LEGACY_PLATFORM_MP_ENV==='true'||process.env.NODE_ENV!=='production';
  if(provedor==='mercadopago'&&legacyAllowed)return {secret:{access_token:process.env.MP_ACCESS_TOKEN||null,webhook_secret:process.env.MP_WEBHOOK_SECRET||null},publicKey:process.env.MP_PUBLIC_KEY||null,environment:'production',metadata:{legacy:true},source:'environment_legacy'};
  return {secret:{},publicKey:null,environment:'production',metadata:{},source:'none'};
}

async function getPlatformMercadoPagoCredentials(){
  const c=await getPlatformGatewayCredentials('mercadopago');
  const accessToken=String(c.secret?.access_token||'').trim()||null;
  const publicKey=String(c.publicKey||'').trim()||null;
  const webhookSecret=String(c.secret?.webhook_secret||'').trim()||null;
  return {accessToken,publicKey,webhookSecret,configured:!!accessToken,cardConfigured:!!(accessToken&&publicKey),webhookConfigured:!!webhookSecret,source:c.source,environment:c.environment||'production',capabilities:{checked:c.metadata?.checked===true,pix_available:c.metadata?.pix_available??null,credit_card_available:c.metadata?.credit_card_available??null},account:{id:String(c.metadata?.provider_account_id||''),nome:String(c.metadata?.nickname||''),email:String(c.metadata?.email||''),site_id:String(c.metadata?.site_id||'')}};
}
async function platformWebhookSecret(){const c=await getPlatformMercadoPagoCredentials();return c.webhookSecret||String(process.env.MP_WEBHOOK_SECRET||'').trim()||null;}

module.exports={ensurePlatformPaymentGatewaySchema,savePlatformGatewayCredentials,listPlatformGateways,disconnectPlatformGateway,getPlatformGatewayCredentials,getPlatformMercadoPagoCredentials,platformWebhookSecret,diagnosePlatformMercadoPago,inspectMercadoPagoCapabilities,mercadoPagoCredentialEnvironment};
