const crypto=require('crypto');
const pool=require('../config/db');
const {encrypt}=require('./secrets');
const {externalSignal}=require('../utils/http');

const PROVIDERS={
  mercadopago:{id:'mercadopago',nome:'Mercado Pago',tipo:'oauth',checkout:true,metodos:['Pix','Cartão'],descricao:'Receba Pix e cartão diretamente na conta Mercado Pago da barbearia.'},
  pagbank:{id:'pagbank',nome:'PagBank',tipo:'oauth',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Conexão via PagBank Connect preparada para a próxima etapa de cobrança.'},
  asaas:{id:'asaas',nome:'Asaas',tipo:'api_key',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Conecte com uma chave de API da própria conta Asaas.'},
  pagarme:{id:'pagarme',nome:'Pagar.me',tipo:'api_key',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Conecte as chaves da conta Pagar.me com armazenamento criptografado.'},
  stripe:{id:'stripe',nome:'Stripe',tipo:'oauth',checkout:false,metodos:['Cartão','Pix*'],descricao:'Stripe Connect preparado. Métodos disponíveis dependem da conta e da região.'}
};

function appUrl(){return (process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'')}
function pagbankEnv(){return String(process.env.PAGBANK_ENV||'production').toLowerCase()==='sandbox'?'sandbox':'production'}
function platformReady(id){
  if(id==='mercadopago')return !!(process.env.MP_CLIENT_ID&&process.env.MP_CLIENT_SECRET&&process.env.APP_SECRETS_ENCRYPTION_KEY);
  if(id==='pagbank')return !!(process.env.PAGBANK_CLIENT_ID&&process.env.PAGBANK_CLIENT_SECRET&&process.env.PAGBANK_PLATFORM_TOKEN&&process.env.APP_SECRETS_ENCRYPTION_KEY);
  if(id==='stripe')return !!(process.env.STRIPE_CONNECT_CLIENT_ID&&process.env.STRIPE_SECRET_KEY&&process.env.APP_SECRETS_ENCRYPTION_KEY);
  return !!process.env.APP_SECRETS_ENCRYPTION_KEY;
}
function redirectUri(id){
  if(id==='pagbank')return process.env.PAGBANK_OAUTH_REDIRECT_URI||`${appUrl()}/api/pagamentos/oauth/pagbank/callback`;
  if(id==='stripe')return process.env.STRIPE_OAUTH_REDIRECT_URI||`${appUrl()}/api/pagamentos/oauth/stripe/callback`;
  return null;
}
function safeError(e){return String(e?.message||'Falha ao validar integração').replace(/[\r\n\t]+/g,' ').slice(0,240)}
async function jsonResponse(r){let d={};try{d=await r.json()}catch{}return d}

async function ensurePaymentGatewaySchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS integracoes_pagamento(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,provedor VARCHAR(40) NOT NULL,mp_user_id TEXT,access_token_enc TEXT,refresh_token_enc TEXT,public_key TEXT,scope TEXT,expires_at TIMESTAMP,status VARCHAR(30) DEFAULT 'desconectado',conectado_em TIMESTAMP,atualizado_em TIMESTAMP DEFAULT NOW(),UNIQUE(barbearia_id,provedor))`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS provider_account_id TEXT`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS secret_enc TEXT`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'production'`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP`);
  await pool.query(`ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS last_error TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS oauth_states(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,state TEXT UNIQUE NOT NULL,code_verifier TEXT NOT NULL,provedor VARCHAR(40) NOT NULL DEFAULT 'mercadopago',expira_em TIMESTAMP NOT NULL,criado_em TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS provedor VARCHAR(40) NOT NULL DEFAULT 'mercadopago'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_integracoes_pagamento_tenant ON integracoes_pagamento(barbearia_id,provedor,status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_oauth_states_provider_expira ON oauth_states(provedor,expira_em)`);
}

async function saveIntegration({barbeariaId,provedor,providerAccountId=null,accessToken=null,refreshToken=null,secret=null,publicKey=null,scope=null,expiresAt=null,environment='production',metadata={},capabilities={}}){
  await pool.query(`INSERT INTO integracoes_pagamento(barbearia_id,provedor,provider_account_id,access_token_enc,refresh_token_enc,secret_enc,public_key,scope,expires_at,environment,metadata,capabilities,status,last_verified_at,last_error,conectado_em,atualizado_em)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,'conectado',NOW(),NULL,NOW(),NOW())
    ON CONFLICT(barbearia_id,provedor) DO UPDATE SET provider_account_id=EXCLUDED.provider_account_id,access_token_enc=EXCLUDED.access_token_enc,refresh_token_enc=EXCLUDED.refresh_token_enc,secret_enc=EXCLUDED.secret_enc,public_key=EXCLUDED.public_key,scope=EXCLUDED.scope,expires_at=EXCLUDED.expires_at,environment=EXCLUDED.environment,metadata=EXCLUDED.metadata,capabilities=EXCLUDED.capabilities,status='conectado',last_verified_at=NOW(),last_error=NULL,conectado_em=NOW(),atualizado_em=NOW()`,[
      barbeariaId,provedor,providerAccountId,accessToken?encrypt(accessToken):null,refreshToken?encrypt(refreshToken):null,secret?encrypt(secret):null,publicKey||null,scope||null,expiresAt||null,environment,JSON.stringify(metadata||{}),JSON.stringify(capabilities||{})
    ]);
}
async function markError(barbeariaId,provedor,e){await pool.query(`INSERT INTO integracoes_pagamento(barbearia_id,provedor,status,last_error,atualizado_em) VALUES($1,$2,'erro',$3,NOW()) ON CONFLICT(barbearia_id,provedor) DO UPDATE SET status='erro',last_error=$3,atualizado_em=NOW()`,[barbeariaId,provedor,safeError(e)]).catch(()=>{})}
async function listGateways(barbeariaId){
  const r=await pool.query(`SELECT provedor,provider_account_id,mp_user_id,public_key,scope,expires_at,environment,status,conectado_em,atualizado_em,last_verified_at,last_error,metadata,capabilities FROM integracoes_pagamento WHERE barbearia_id=$1`,[barbeariaId]);
  const by=new Map(r.rows.map(x=>[x.provedor,x]));
  return Object.values(PROVIDERS).map(p=>{const x=by.get(p.id)||{};return {...p,plataforma_pronta:platformReady(p.id),conectado:x.status==='conectado',status:x.status||'desconectado',conta_id:x.provider_account_id||x.mp_user_id||null,ambiente:x.environment||'production',conectado_em:x.conectado_em||null,verificado_em:x.last_verified_at||null,ultimo_erro:x.last_error||null,checkout_ativo:p.checkout&&x.status==='conectado'};});
}
async function createOauthState(barbeariaId,provedor){const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');await pool.query(`DELETE FROM oauth_states WHERE expira_em<NOW() OR (barbearia_id=$1 AND provedor=$2)`,[barbeariaId,provedor]);await pool.query(`INSERT INTO oauth_states(barbearia_id,state,code_verifier,provedor,expira_em) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')`,[barbeariaId,state,verifier,provedor]);return state}
async function consumeOauthState(state,provedor){const r=await pool.query(`DELETE FROM oauth_states WHERE state=$1 AND provedor=$2 AND expira_em>NOW() RETURNING *`,[state,provedor]);if(!r.rowCount)throw new Error('Solicitação de conexão inválida ou expirada');return r.rows[0]}
async function createOauthUrl(provedor,barbeariaId){
  if(!['pagbank','stripe'].includes(provedor))throw new Error('Gateway não usa este fluxo de conexão');
  if(!platformReady(provedor))throw new Error(`Credenciais da plataforma ${PROVIDERS[provedor].nome} ainda não configuradas`);
  const state=await createOauthState(barbeariaId,provedor);
  if(provedor==='pagbank'){
    const base=pagbankEnv()==='sandbox'?'https://connect.sandbox.pagbank.com.br/oauth2/authorize':'https://connect.pagbank.com.br/oauth2/authorize';
    const u=new URL(base);u.searchParams.set('response_type','code');u.searchParams.set('client_id',process.env.PAGBANK_CLIENT_ID);u.searchParams.set('redirect_uri',redirectUri('pagbank'));u.searchParams.set('scope','payments.read payments.create payments.refund accounts.read checkout.create checkout.view checkout.update');u.searchParams.set('state',state);return u.toString();
  }
  const u=new URL('https://connect.stripe.com/oauth/authorize');u.searchParams.set('response_type','code');u.searchParams.set('client_id',process.env.STRIPE_CONNECT_CLIENT_ID);u.searchParams.set('scope','read_write');u.searchParams.set('redirect_uri',redirectUri('stripe'));u.searchParams.set('state',state);return u.toString();
}
async function finishPagbank({code,state}){const st=await consumeOauthState(state,'pagbank');const env=pagbankEnv(),base=env==='sandbox'?'https://sandbox.api.pagseguro.com':'https://api.pagseguro.com';const r=await fetch(`${base}/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.PAGBANK_PLATFORM_TOKEN}`,'x-client-id':process.env.PAGBANK_CLIENT_ID,'x-client-secret':process.env.PAGBANK_CLIENT_SECRET},body:JSON.stringify({grant_type:'authorization_code',code,redirect_uri:redirectUri('pagbank')}),signal:externalSignal()});const d=await jsonResponse(r);if(!r.ok)throw new Error(d.error_description||d.message||`PagBank respondeu ${r.status}`);const expires=d.expires_in?new Date(Date.now()+Number(d.expires_in)*1000):null;await saveIntegration({barbeariaId:st.barbearia_id,provedor:'pagbank',providerAccountId:d.account_id||d.user_id||null,accessToken:d.access_token,refreshToken:d.refresh_token,scope:d.scope,expiresAt:expires,environment:env,metadata:{token_type:d.token_type||null},capabilities:{payments:true,refunds:true,checkout:true}});return st.barbearia_id}
async function finishStripe({code,state}){const st=await consumeOauthState(state,'stripe');const body=new URLSearchParams({client_secret:process.env.STRIPE_SECRET_KEY,code,grant_type:'authorization_code'});const r=await fetch('https://connect.stripe.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:externalSignal()});const d=await jsonResponse(r);if(!r.ok)throw new Error(d.error_description||d.error||`Stripe respondeu ${r.status}`);await saveIntegration({barbeariaId:st.barbearia_id,provedor:'stripe',providerAccountId:d.stripe_user_id||null,accessToken:d.access_token,refreshToken:d.refresh_token,scope:d.scope,environment:d.livemode?'production':'sandbox',metadata:{livemode:!!d.livemode},capabilities:{connect:true}});return st.barbearia_id}
async function finishOauth(provedor,payload){if(provedor==='pagbank')return finishPagbank(payload);if(provedor==='stripe')return finishStripe(payload);throw new Error('Gateway OAuth inválido')}
async function connectAsaas({barbeariaId,apiKey,environment}){const key=String(apiKey||'').trim(),env=environment==='sandbox'?'sandbox':'production';if(key.length<20||key.length>500)throw new Error('Chave API Asaas inválida');const base=env==='sandbox'?'https://api-sandbox.asaas.com/v3':'https://api.asaas.com/v3';try{const r=await fetch(`${base}/myAccount/accountNumber`,{headers:{access_token:key,'User-Agent':'BarberFlow/2.2','Content-Type':'application/json'},signal:externalSignal()});const d=await jsonResponse(r);if(!r.ok)throw new Error(d.errors?.[0]?.description||`Asaas respondeu ${r.status}`);const account=d.accountNumber||d.account_number||d.id||null;await saveIntegration({barbeariaId,provedor:'asaas',providerAccountId:account?String(account):null,secret:key,environment:env,metadata:{validation_endpoint:'myAccount/accountNumber'},capabilities:{pix:true,card:true,boleto:true}});return {conta_id:account||null}}catch(e){await markError(barbeariaId,'asaas',e);throw e}}
async function connectPagarme({barbeariaId,secretKey,publicKey}){const secret=String(secretKey||'').trim(),pub=String(publicKey||'').trim()||null;if(!/^sk_(?:test_)?[A-Za-z0-9_-]{8,}$/.test(secret))throw new Error('Secret Key Pagar.me inválida');if(pub&&!/^pk_(?:test_)?[A-Za-z0-9_-]{8,}$/.test(pub))throw new Error('Public Key Pagar.me inválida');try{const auth=Buffer.from(`${secret}:`).toString('base64');const r=await fetch('https://api.pagar.me/core/v5/subscriptions?size=1',{headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json'},signal:externalSignal()});const d=await jsonResponse(r);if(!r.ok)throw new Error(d.message||d.errors?.[0]?.message||`Pagar.me respondeu ${r.status}`);const env=secret.startsWith('sk_test_')?'sandbox':'production';await saveIntegration({barbeariaId,provedor:'pagarme',secret,publicKey:pub,environment:env,metadata:{api_version:'v5'},capabilities:{pix:true,card:true,boleto:true,subscriptions:true}});return {ambiente:env}}catch(e){await markError(barbeariaId,'pagarme',e);throw e}}
async function disconnectGateway(barbeariaId,provedor){if(!PROVIDERS[provedor])throw new Error('Gateway inválido');await pool.query(`UPDATE integracoes_pagamento SET status='desconectado',access_token_enc=NULL,refresh_token_enc=NULL,secret_enc=NULL,last_error=NULL,atualizado_em=NOW() WHERE barbearia_id=$1 AND provedor=$2`,[barbeariaId,provedor])}
module.exports={PROVIDERS,ensurePaymentGatewaySchema,listGateways,platformReady,createOauthUrl,finishOauth,connectAsaas,connectPagarme,disconnectGateway};
