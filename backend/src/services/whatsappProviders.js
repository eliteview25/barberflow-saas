const crypto=require('crypto');
const pool=require('../config/db');
const {encrypt,decrypt}=require('./secrets');
const {externalSignal}=require('../utils/http');
const qr=require('./whatsappQr');

const PROVIDERS=['meta','360dialog','twilio','evolution'];
const LABELS={meta:'Meta Cloud API','360dialog':'360dialog',twilio:'Twilio',evolution:'Evolution / QR Code'};
function digits(v){return String(v||'').replace(/\D/g,'').slice(-15)}
function validPhone(v){const d=digits(v);return d.length>=10&&d.length<=15}
function parseConfig(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)}catch{return{}}}
function publicRow(r){if(!r)return null;const c=parseConfig(r.config);return{id:r.id,provedor:r.provedor,status:r.status,numero:r.numero||c.numero||null,config:c,conectado_em:r.conectado_em,atualizado_em:r.atualizado_em,ultimo_webhook_em:r.ultimo_webhook_em||null,ultimo_webhook_evento:r.ultimo_webhook_evento||null}}
function secret(r){return r?.secret_enc?decrypt(r.secret_enc):null}
function tokenHash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function appBase(){return String(process.env.APP_URL||'').replace(/\/$/,'')}
function providerCode(value){const s=String(value||'').trim().slice(0,120);return /^[A-Za-z0-9_.:-]+$/.test(s)?s:''}

async function ensureWhatsAppProviderSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS whatsapp_conexoes(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    provedor VARCHAR(30) NOT NULL,
    numero VARCHAR(40),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret_enc TEXT,
    webhook_token_hash VARCHAR(64),
    webhook_token_enc TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'desconectado',
    conectado_em TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_webhook_em TIMESTAMP,
    ultimo_webhook_evento VARCHAR(80),
    UNIQUE(barbearia_id,provedor)
  )`);
  await pool.query(`ALTER TABLE whatsapp_conexoes ADD COLUMN IF NOT EXISTS ultimo_webhook_em TIMESTAMP`);
  await pool.query(`ALTER TABLE whatsapp_conexoes ADD COLUMN IF NOT EXISTS ultimo_webhook_evento VARCHAR(80)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_conexao_webhook_token ON whatsapp_conexoes(webhook_token_hash) WHERE webhook_token_hash IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_whatsapp_conexoes_tenant_status ON whatsapp_conexoes(barbearia_id,status,provedor)`);
  await pool.query(`ALTER TABLE automacoes_config ADD COLUMN IF NOT EXISTS whatsapp_provedor VARCHAR(30)`);
  // Backfill da conexão Meta existente sem desencriptar/recriptar o segredo.
  await pool.query(`INSERT INTO whatsapp_conexoes(barbearia_id,provedor,numero,config,secret_enc,status,conectado_em,atualizado_em)
    SELECT barbearia_id,'meta',numero,jsonb_build_object('phone_number_id',phone_number_id,'business_account_id',business_account_id,'numero',numero),access_token_enc,status,conectado_em,COALESCE(atualizado_em,NOW())
    FROM integracoes_whatsapp
    ON CONFLICT(barbearia_id,provedor) DO NOTHING`).catch(()=>{});
  // Backfill da sessão Evolution já existente.
  await pool.query(`INSERT INTO whatsapp_conexoes(barbearia_id,provedor,numero,config,status,conectado_em,atualizado_em)
    SELECT barbearia_id,'evolution',numero,jsonb_build_object('instance_name',instance_name,'numero',numero),status,conectado_em,COALESCE(atualizado_em,NOW())
    FROM integracoes_whatsapp_qr
    ON CONFLICT(barbearia_id,provedor) DO NOTHING`).catch(()=>{});
  await pool.query(`UPDATE automacoes_config ac SET whatsapp_provedor=CASE WHEN COALESCE(ac.canal_lembretes,'cloud_api')='qr' THEN 'evolution' ELSE 'meta' END WHERE whatsapp_provedor IS NULL`);
}

async function row(barbeariaId,provider){if(!PROVIDERS.includes(provider))return null;const r=await pool.query(`SELECT * FROM whatsapp_conexoes WHERE barbearia_id=$1 AND provedor=$2`,[barbeariaId,provider]);return r.rows[0]||null}
async function byId(id){const r=await pool.query(`SELECT * FROM whatsapp_conexoes WHERE id=$1 AND status='conectado'`,[id]);return r.rows[0]||null}
async function list(barbeariaId){const r=await pool.query(`SELECT * FROM whatsapp_conexoes WHERE barbearia_id=$1 ORDER BY CASE provedor WHEN 'meta' THEN 1 WHEN '360dialog' THEN 2 WHEN 'twilio' THEN 3 ELSE 4 END`,[barbeariaId]);return r.rows.map(publicRow)}
async function activeProvider(barbeariaId){
  const c=await pool.query(`SELECT whatsapp_provedor FROM automacoes_config WHERE barbearia_id=$1`,[barbeariaId]);
  const wanted=c.rows[0]?.whatsapp_provedor;if(PROVIDERS.includes(wanted))return wanted;
  const r=await pool.query(`SELECT provedor FROM whatsapp_conexoes WHERE barbearia_id=$1 AND status='conectado' ORDER BY atualizado_em DESC LIMIT 1`,[barbeariaId]);return r.rows[0]?.provedor||'meta';
}
async function activeConnection(barbeariaId){const p=await activeProvider(barbeariaId);const r=await row(barbeariaId,p);return r&&r.status==='conectado'?r:null}
async function setActiveProvider(barbeariaId,provider){if(!PROVIDERS.includes(provider))throw new Error('Provedor inválido');const r=await row(barbeariaId,provider);if(!r||r.status!=='conectado')throw new Error(`${LABELS[provider]} ainda não está conectado`);await pool.query(`INSERT INTO automacoes_config(barbearia_id,whatsapp_provedor,canal_lembretes) VALUES($1,$2,$3) ON CONFLICT(barbearia_id) DO UPDATE SET whatsapp_provedor=EXCLUDED.whatsapp_provedor,canal_lembretes=EXCLUDED.canal_lembretes,atualizado_em=NOW()`,[barbeariaId,provider,provider==='evolution'?'qr':'cloud_api']);return provider}
async function save(barbeariaId,provider,{numero=null,config={},secretValue=null,status='conectado',webhookToken=null}={}){
  if(!PROVIDERS.includes(provider))throw new Error('Provedor inválido');
  const enc=secretValue?encrypt(secretValue):null,whash=webhookToken?tokenHash(webhookToken):null,wenc=webhookToken?encrypt(webhookToken):null;
  const r=await pool.query(`INSERT INTO whatsapp_conexoes(barbearia_id,provedor,numero,config,secret_enc,webhook_token_hash,webhook_token_enc,status,conectado_em,atualizado_em)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::varchar,CASE WHEN $8::varchar='conectado' THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(barbearia_id,provedor) DO UPDATE SET numero=EXCLUDED.numero,config=EXCLUDED.config,secret_enc=COALESCE(EXCLUDED.secret_enc,whatsapp_conexoes.secret_enc),webhook_token_hash=COALESCE(EXCLUDED.webhook_token_hash,whatsapp_conexoes.webhook_token_hash),webhook_token_enc=COALESCE(EXCLUDED.webhook_token_enc,whatsapp_conexoes.webhook_token_enc),status=EXCLUDED.status,conectado_em=CASE WHEN EXCLUDED.status='conectado' THEN COALESCE(whatsapp_conexoes.conectado_em,NOW()) ELSE whatsapp_conexoes.conectado_em END,atualizado_em=NOW() RETURNING *`,[barbeariaId,provider,numero||null,JSON.stringify(config||{}),enc,whash,wenc,status]);return r.rows[0]
}
async function ensureWebhookToken(connection){if(connection.webhook_token_enc){try{return decrypt(connection.webhook_token_enc)}catch{}}const raw=crypto.randomBytes(32).toString('base64url'),hash=tokenHash(raw),enc=encrypt(raw);await pool.query(`UPDATE whatsapp_conexoes SET webhook_token_hash=$1,webhook_token_enc=$2,atualizado_em=NOW() WHERE id=$3`,[hash,enc,connection.id]);connection.webhook_token_hash=hash;connection.webhook_token_enc=enc;return raw}
async function byWebhookToken(provider,raw){if(!PROVIDERS.includes(provider)||!raw)return null;const r=await pool.query(`SELECT * FROM whatsapp_conexoes WHERE provedor=$1 AND webhook_token_hash=$2`,[provider,tokenHash(raw)]);return r.rows[0]||null}
async function findMetaByPhoneId(phoneId){const r=await pool.query(`SELECT * FROM whatsapp_conexoes WHERE provedor='meta' AND status='conectado' AND config->>'phone_number_id'=$1`,[String(phoneId)]);return r.rows[0]||null}
function webhookUrl(connection,token){const base=appBase();if(!base||!connection||!token)return null;return `${base}/api/whatsapp/webhook/${encodeURIComponent(connection.provedor)}/${encodeURIComponent(token)}`}
async function webhookUrlFor(connection){if(!connection||!['360dialog','twilio','evolution'].includes(connection.provedor))return connection?.provedor==='meta'&&appBase()?`${appBase()}/api/whatsapp/webhook`:null;const token=await ensureWebhookToken(connection);return webhookUrl(connection,token)}

async function jsonFetch(url,opts={}){const r=await fetch(url,{...opts,signal:externalSignal()});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(`Provedor WhatsApp HTTP ${r.status}`);e.status=r.status;e.providerCode=providerCode(d?.error?.code||d?.code||d?.error);throw e}return d}
async function metaRequest(integ,payload){const c=parseConfig(integ.config),access=secret(integ);if(!c.phone_number_id||!access)throw new Error('Meta Cloud API não configurada');const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';return jsonFetch(`https://graph.facebook.com/${version}/${c.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(payload)})}
async function d360Request(integ,payload){const key=secret(integ);if(!key)throw new Error('API Key da 360dialog não configurada');return jsonFetch('https://waba-v2.360dialog.io/messages',{method:'POST',headers:{'D360-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify(payload)})}
async function twilioRequest(integ,fields){const c=parseConfig(integ.config),auth=secret(integ),sid=String(c.account_sid||'');if(!sid||!auth||!c.sender)throw new Error('Twilio não configurada');const payload={...fields};if(!payload.StatusCallback){const callback=await webhookUrlFor(integ);if(callback)payload.StatusCallback=callback;}const body=new URLSearchParams(payload);return jsonFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()})}
function normalizeResult(provider,d){const id=d?.messages?.[0]?.id||d?.sid||d?.key?.id||d?.response?.key?.id||null;return{provider,messages:id?[{id:String(id)}]:[]}}
async function sendText(integ,to,body){if(!integ)throw new Error('WhatsApp não conectado');if(!validPhone(to))throw new Error('Telefone inválido');const p=integ.provedor||'meta',text=String(body||'').slice(0,4096),dest=digits(to);
  if(p==='meta')return normalizeResult(p,await metaRequest(integ,{messaging_product:'whatsapp',recipient_type:'individual',to:dest,type:'text',text:{preview_url:true,body:text}}));
  if(p==='360dialog')return normalizeResult(p,await d360Request(integ,{messaging_product:'whatsapp',recipient_type:'individual',to:dest,type:'text',text:{preview_url:true,body:text}}));
  if(p==='twilio'){const c=parseConfig(integ.config),from=String(c.sender||'').startsWith('whatsapp:')?String(c.sender):`whatsapp:+${digits(c.sender)}`,target=`whatsapp:+${dest}`;return normalizeResult(p,await twilioRequest(integ,{From:from,To:target,Body:text}));}
  if(p==='evolution'){const c=parseConfig(integ.config),name=c.instance_name||qr.instanceName(integ.barbearia_id);return normalizeResult(p,await qr.sendTextByInstance(name,dest,text));}
  throw new Error('Provedor WhatsApp desconhecido');
}
async function sendTemplate(integ,to,name,params=[],language='pt_BR',options={}){if(!integ)throw new Error('WhatsApp não conectado');if(!validPhone(to))throw new Error('Telefone inválido');const p=integ.provedor||'meta',dest=digits(to);
  if(p==='evolution'){const fallback=String(options.fallbackText||'').trim();if(!fallback)throw new Error('Evolution exige uma mensagem de texto para esta automação');return sendText(integ,dest,fallback)}
  if(p==='twilio'){
    const sid=String(name||'').trim();if(!/^HX[a-zA-Z0-9]{20,}$/.test(sid))throw new Error('Na Twilio, informe o Content SID (HX...) do template aprovado');
    const vars={};params.forEach((x,i)=>{vars[String(i+1)]=String(x)});if(options.urlButtonParam)vars[String(params.length+1)]=String(options.urlButtonParam).slice(0,200);
    const c=parseConfig(integ.config),from=String(c.sender||'').startsWith('whatsapp:')?String(c.sender):`whatsapp:+${digits(c.sender)}`,fields={From:from,To:`whatsapp:+${dest}`,ContentSid:sid};if(Object.keys(vars).length)fields.ContentVariables=JSON.stringify(vars);return normalizeResult(p,await twilioRequest(integ,fields));
  }
  if(!/^[A-Za-z0-9_]{1,512}$/.test(String(name||'')))throw new Error('Template WhatsApp inválido');const components=[];if(params.length)components.push({type:'body',parameters:params.map(x=>({type:'text',text:String(x)}))});if(options.urlButtonParam)components.push({type:'button',sub_type:'url',index:String(options.urlButtonIndex||0),parameters:[{type:'text',text:String(options.urlButtonParam).slice(0,200)}]});const payload={messaging_product:'whatsapp',to:dest,type:'template',template:{name:String(name),language:{code:language},components}};
  return normalizeResult(p,p==='360dialog'?await d360Request(integ,payload):await metaRequest(integ,payload));
}
async function set360Webhook(integ){const url=await webhookUrlFor(integ);if(!url)return{ok:false,aviso:'APP_URL não configurada'};const key=secret(integ);try{await jsonFetch('https://waba-v2.360dialog.io/v1/configs/webhook',{method:'POST',headers:{'D360-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({url})});return{ok:true,url}}catch(e){console.error('whatsapp_360_webhook',e.message);return{ok:false,url,aviso:'A 360dialog não aceitou a configuração automática do webhook'}}}
async function validateTwilioCredentials(accountSid,authToken){if(!/^AC[a-zA-Z0-9]{20,}$/.test(String(accountSid||'')))throw new Error('Account SID da Twilio inválido');const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,{headers:{Authorization:`Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`},signal:externalSignal()});if(!r.ok)throw new Error('A Twilio recusou o Account SID/Auth Token informado');return true}
function twilioSignatureValid(req,integ){const auth=secret(integ);if(!auth)return false;const sig=String(req.headers['x-twilio-signature']||'');if(!sig)return false;const base=appBase()||`${req.protocol}://${req.get('host')}`;let data=`${base}${req.originalUrl}`;const body=req.body||{};for(const k of Object.keys(body).sort()){const values=Array.isArray(body[k])?body[k]:[body[k]];for(const v of values)data+=k+String(v??'')}const expected=crypto.createHmac('sha1',auth).update(data).digest('base64');const a=Buffer.from(sig),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function providerCapabilities(provider){return{inbound:true,text:true,templates:provider!=='evolution',delivery_status:provider!=='evolution',marketing:true,official:provider!=='evolution',qr:provider==='evolution'}}
function platformAvailability(){return{meta:{ready:!!process.env.META_WHATSAPP_APP_SECRET,reason:process.env.META_WHATSAPP_APP_SECRET?null:'META_WHATSAPP_APP_SECRET não configurado na plataforma'},'360dialog':{ready:true,reason:null},twilio:{ready:true,reason:null},evolution:{ready:qr.configured(),reason:qr.configured()?null:'EVOLUTION_API_URL/EVOLUTION_API_KEY não configurados na plataforma'}}}

module.exports={PROVIDERS,LABELS,ensureWhatsAppProviderSchema,row,byId,list,activeProvider,activeConnection,setActiveProvider,save,ensureWebhookToken,byWebhookToken,findMetaByPhoneId,webhookUrlFor,sendText,sendTemplate,set360Webhook,validateTwilioCredentials,twilioSignatureValid,providerCapabilities,platformAvailability,publicRow,parseConfig,validPhone,digits};
