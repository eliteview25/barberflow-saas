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

async function verifyMercadoPagoAccessToken(token){
  const r=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${token}`},signal:externalSignal()});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){const e=new Error('Access Token do Mercado Pago não foi aceito');e.status=400;throw e;}
  return {provider_account_id:String(d.id||''),nickname:String(d.nickname||'').slice(0,120),email:String(d.email||'').slice(0,180)};
}

async function savePlatformGatewayCredentials(userId,provedor,raw){
  if(!PROVIDERS[provedor]){const e=new Error('Gateway inválido');e.status=404;throw e;}
  if(!process.env.APP_SECRETS_ENCRYPTION_KEY)throw new Error('Criptografia de segredos não configurada no servidor');
  const c=credentialsFor(provedor,raw);
  let verified={};
  if(provedor==='mercadopago'){
    verified=await verifyMercadoPagoAccessToken(c.accessToken);
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
  return Object.values(PROVIDERS).map(p=>{const x=by.get(p.id)||{},connected=x.status==='credenciais_salvas',meta=x.metadata||{};return {...p,descricao:p.id==='mercadopago'?'Conta central da plataforma. Todos os pagamentos Starter, Pro e Premium por Pix/cartão são recebidos nesta conta.':p.descricao,credenciais_salvas:connected,status:x.status||'sem_credenciais',ambiente:x.environment||'production',atualizado_em:x.atualizado_em||null,verificado:p.id==='mercadopago'&&connected&&!!meta.provider_account_id,recebe_assinaturas:p.id==='mercadopago'&&connected,conta_recebedora:p.id==='mercadopago'&&connected?{id:String(meta.provider_account_id||''),nome:String(meta.nickname||'').slice(0,120),email:String(meta.email||'').slice(0,180)}:null};});
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
  return {accessToken,publicKey,webhookSecret,configured:!!accessToken,cardConfigured:!!(accessToken&&publicKey),webhookConfigured:!!webhookSecret,source:c.source,account:{id:String(c.metadata?.provider_account_id||''),nome:String(c.metadata?.nickname||''),email:String(c.metadata?.email||'')}};
}
async function platformWebhookSecret(){const c=await getPlatformMercadoPagoCredentials();return c.webhookSecret||String(process.env.MP_WEBHOOK_SECRET||'').trim()||null;}

module.exports={ensurePlatformPaymentGatewaySchema,savePlatformGatewayCredentials,listPlatformGateways,disconnectPlatformGateway,getPlatformGatewayCredentials,getPlatformMercadoPagoCredentials,platformWebhookSecret};
