const pool=require('../config/db');
const {encrypt}=require('./secrets');

const PROVIDERS={
  mercadopago:{id:'mercadopago',nome:'Mercado Pago',checkout:true,metodos:['Pix','Cartão'],descricao:'Salve as credenciais da conta Mercado Pago da barbearia.',campos:[{id:'access_token',label:'Access Token',tipo:'password',required:true,placeholder:'APP_USR-...'},{id:'public_key',label:'Public Key',tipo:'text',required:true,placeholder:'APP_USR-...'}]},
  pagbank:{id:'pagbank',nome:'PagBank',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Deixe o token da conta pronto para a futura integração PagBank.',campos:[{id:'token',label:'Token de autenticação',tipo:'password',required:true,placeholder:'Token PagBank'},{id:'public_key',label:'Chave pública',tipo:'text',required:false,placeholder:'Opcional nesta etapa'}]},
  asaas:{id:'asaas',nome:'Asaas',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Salve a API Key da conta Asaas para ativarmos o driver depois.',campos:[{id:'api_key',label:'API Key',tipo:'password',required:true,placeholder:'$aact_prod_...'},{id:'environment',label:'Ambiente',tipo:'select',required:true,options:[['production','Produção'],['sandbox','Sandbox']]}]},
  pagarme:{id:'pagarme',nome:'Pagar.me',checkout:false,metodos:['Pix','Cartão','Boleto'],descricao:'Salve as chaves da conta Pagar.me com armazenamento criptografado.',campos:[{id:'secret_key',label:'Secret Key',tipo:'password',required:true,placeholder:'sk_...'},{id:'public_key',label:'Public Key',tipo:'text',required:true,placeholder:'pk_...'}]},
  stripe:{id:'stripe',nome:'Stripe',checkout:false,metodos:['Cartão','Pix*'],descricao:'Salve as chaves da conta Stripe para a futura integração.',campos:[{id:'secret_key',label:'Secret Key',tipo:'password',required:true,placeholder:'sk_live_... ou sk_test_...'},{id:'publishable_key',label:'Publishable Key',tipo:'text',required:true,placeholder:'pk_live_... ou pk_test_...'}]}
};

function clean(v,max=1000){const s=String(v??'').trim();return s&&s.length<=max?s:null}
function invalid(msg){const e=new Error(msg);e.status=400;throw e}
function credentialsFor(provedor,raw={}){
  const p=PROVIDERS[provedor];if(!p)invalid('Gateway inválido');
  if(provedor==='mercadopago'){
    const access_token=clean(raw.access_token,1000),public_key=clean(raw.public_key,500);
    if(!access_token||access_token.length<20)invalid('Informe um Access Token válido do Mercado Pago');
    if(!public_key||public_key.length<10)invalid('Informe a Public Key do Mercado Pago');
    return {secret:{access_token},publicKey:public_key,environment:/TEST|test/.test(access_token)?'sandbox':'production',accessToken:access_token};
  }
  if(provedor==='pagbank'){
    const token=clean(raw.token,1500),public_key=clean(raw.public_key,1500);
    if(!token||token.length<20)invalid('Informe o token de autenticação do PagBank');
    return {secret:{token},publicKey:public_key,environment:raw.environment==='sandbox'?'sandbox':'production'};
  }
  if(provedor==='asaas'){
    const api_key=clean(raw.api_key,1000),environment=raw.environment==='sandbox'?'sandbox':'production';
    if(!api_key||api_key.length<20||!api_key.startsWith('$aact_'))invalid('Informe uma API Key Asaas válida');
    return {secret:{api_key},publicKey:null,environment};
  }
  if(provedor==='pagarme'){
    const secret_key=clean(raw.secret_key,1000),public_key=clean(raw.public_key,1000);
    if(!secret_key||!/^sk_(?:test_)?[A-Za-z0-9_-]{8,}$/.test(secret_key))invalid('Informe uma Secret Key Pagar.me válida');
    if(!public_key||!/^pk_(?:test_)?[A-Za-z0-9_-]{8,}$/.test(public_key))invalid('Informe uma Public Key Pagar.me válida');
    return {secret:{secret_key},publicKey:public_key,environment:secret_key.startsWith('sk_test_')?'sandbox':'production'};
  }
  if(provedor==='stripe'){
    const secret_key=clean(raw.secret_key,1000),publishable_key=clean(raw.publishable_key,1000);
    if(!secret_key||!/^sk_(?:live|test)_[A-Za-z0-9_\-]{8,}$/.test(secret_key))invalid('Informe uma Secret Key Stripe válida');
    if(!publishable_key||!/^pk_(?:live|test)_[A-Za-z0-9_\-]{8,}$/.test(publishable_key))invalid('Informe uma Publishable Key Stripe válida');
    const live=secret_key.startsWith('sk_live_');if(live!==publishable_key.startsWith('pk_live_'))invalid('As chaves Stripe precisam ser do mesmo ambiente');
    return {secret:{secret_key},publicKey:publishable_key,environment:live?'production':'sandbox'};
  }
  invalid('Gateway inválido');
}

async function ensurePaymentGatewaySchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS integracoes_pagamento(id SERIAL PRIMARY KEY,barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,provedor VARCHAR(40) NOT NULL,mp_user_id TEXT,access_token_enc TEXT,refresh_token_enc TEXT,public_key TEXT,scope TEXT,expires_at TIMESTAMP,status VARCHAR(30) DEFAULT 'desconectado',conectado_em TIMESTAMP,atualizado_em TIMESTAMP DEFAULT NOW(),UNIQUE(barbearia_id,provedor))`);
  for(const sql of [
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS provider_account_id TEXT`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS secret_enc TEXT`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'production'`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP`,
    `ALTER TABLE integracoes_pagamento ADD COLUMN IF NOT EXISTS last_error TEXT`
  ])await pool.query(sql);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_integracoes_pagamento_tenant ON integracoes_pagamento(barbearia_id,provedor,status)`);
}

async function saveProviderCredentials(barbeariaId,provedor,raw){
  if(!process.env.APP_SECRETS_ENCRYPTION_KEY)throw new Error('Criptografia de segredos não configurada no servidor');
  const c=credentialsFor(provedor,raw),secretEnc=encrypt(JSON.stringify(c.secret));
  const accessTokenEnc=provedor==='mercadopago'?encrypt(c.accessToken):null;
  const status=provedor==='mercadopago'?'conectado':'credenciais_salvas';
  const fields=Object.keys(c.secret).concat(c.publicKey?['public_key']:[]);
  await pool.query(`INSERT INTO integracoes_pagamento(barbearia_id,provedor,access_token_enc,refresh_token_enc,secret_enc,public_key,environment,metadata,capabilities,status,last_verified_at,last_error,conectado_em,atualizado_em)
    VALUES($1,$2,$3,NULL,$4,$5,$6,$7::jsonb,$8::jsonb,$9,NULL,NULL,NOW(),NOW())
    ON CONFLICT(barbearia_id,provedor) DO UPDATE SET access_token_enc=EXCLUDED.access_token_enc,refresh_token_enc=NULL,secret_enc=EXCLUDED.secret_enc,public_key=EXCLUDED.public_key,environment=EXCLUDED.environment,metadata=EXCLUDED.metadata,capabilities=EXCLUDED.capabilities,status=EXCLUDED.status,last_verified_at=NULL,last_error=NULL,conectado_em=NOW(),atualizado_em=NOW()`,[
      barbeariaId,provedor,accessTokenEnc,secretEnc,c.publicKey||null,c.environment,JSON.stringify({credential_fields:fields,source:'owner_credentials'}),JSON.stringify({credentials_ready:true,checkout_driver:provedor==='mercadopago'}),status
    ]);
  return {provedor,status,ambiente:c.environment,credenciais_salvas:true};
}

async function listGateways(barbeariaId){
  const r=await pool.query(`SELECT provedor,environment,status,conectado_em,atualizado_em,metadata,capabilities FROM integracoes_pagamento WHERE barbearia_id=$1`,[barbeariaId]);
  const by=new Map(r.rows.map(x=>[x.provedor,x]));
  return Object.values(PROVIDERS).map(p=>{const x=by.get(p.id)||{},saved=['conectado','credenciais_salvas'].includes(x.status);return {...p,credenciais_salvas:saved,conectado:p.id==='mercadopago'&&x.status==='conectado',status:x.status||'sem_credenciais',ambiente:x.environment||'production',atualizado_em:x.atualizado_em||null,checkout_ativo:p.checkout&&x.status==='conectado'};});
}

async function disconnectGateway(barbeariaId,provedor){
  if(!PROVIDERS[provedor])invalid('Gateway inválido');
  await pool.query(`UPDATE integracoes_pagamento SET status='desconectado',provider_account_id=NULL,mp_user_id=NULL,access_token_enc=NULL,refresh_token_enc=NULL,secret_enc=NULL,public_key=NULL,scope=NULL,expires_at=NULL,metadata='{}'::jsonb,capabilities='{}'::jsonb,last_verified_at=NULL,last_error=NULL,atualizado_em=NOW() WHERE barbearia_id=$1 AND provedor=$2`,[barbeariaId,provedor]);
}

module.exports={PROVIDERS,credentialsFor,ensurePaymentGatewaySchema,listGateways,saveProviderCredentials,disconnectGateway};
