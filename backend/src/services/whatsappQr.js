const pool=require('../config/db');const {externalSignal}=require('../utils/http');

function base(){return String(process.env.EVOLUTION_API_URL||'').replace(/\/$/,'')}
function key(){return process.env.EVOLUTION_API_KEY||''}
function configured(){return !!(base()&&key())}
function instanceName(barbeariaId){return `barberflow${Number(barbeariaId)}`}
function digits(v){return String(v||'').replace(/\D/g,'').slice(-15)}
function validPhone(v){const d=digits(v);return d.length>=10&&d.length<=15}
function providerCode(value){const s=String(value||'').trim().slice(0,120);return /^[A-Za-z0-9_.:-]+$/.test(s)?s:''}

async function call(path,{method='GET',body,allow404=false}={}){
  if(!configured())throw new Error('Conector QR não configurado na infraestrutura do EliteFlow');
  const r=await fetch(`${base()}${path}`,{
    method,
    headers:{apikey:key(),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
    signal:externalSignal()
  });
  let d={};try{d=await r.json()}catch{}
  if(r.status===404&&allow404)return null;
  if(!r.ok){const e=new Error(`Conector QR HTTP ${r.status}`);e.status=r.status;e.providerCode=providerCode(d?.response?.code||d?.code||d?.error);throw e}
  return d;
}

async function row(barbeariaId){
  const r=await pool.query(`SELECT * FROM integracoes_whatsapp_qr WHERE barbearia_id=$1`,[barbeariaId]);
  return r.rows[0]||null;
}
async function save(barbeariaId,patch={}){
  const name=patch.instance_name||instanceName(barbeariaId);
  const current=await row(barbeariaId);
  if(!current){
    const r=await pool.query(`INSERT INTO integracoes_whatsapp_qr(barbearia_id,instance_name,status,numero,conectado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING *`,[barbeariaId,name,patch.status||'desconectado',patch.numero||null,patch.conectado_em||null]);return r.rows[0];
  }
  const has=(k)=>Object.prototype.hasOwnProperty.call(patch,k);
  const status=has('status')?patch.status:current.status,numero=has('numero')?patch.numero:current.numero,conectado=has('conectado_em')?patch.conectado_em:current.conectado_em;
  const r=await pool.query(`UPDATE integracoes_whatsapp_qr SET instance_name=$2,status=$3,numero=$4,conectado_em=$5,atualizado_em=NOW() WHERE barbearia_id=$1 RETURNING *`,[barbeariaId,name,status,numero,conectado]);return r.rows[0];
}

async function stateByName(name){
  const d=await call(`/instance/connectionState/${encodeURIComponent(name)}`,{allow404:true});
  if(!d)return null;
  return d?.instance?.state||d?.state||null;
}
async function status(barbeariaId){
  const r=await row(barbeariaId);
  if(!r)return {configurado:configured(),conectado:false,status:'desconectado',integracao:null};
  if(!configured())return {configurado:false,conectado:false,status:r.status,integracao:r};
  try{
    const st=await stateByName(r.instance_name);
    if(st){const mapped=st==='open'?'conectado':st==='connecting'?'conectando':'desconectado';await save(barbeariaId,{status:mapped,conectado_em:mapped==='conectado'?(r.conectado_em||new Date()):r.conectado_em});return {configurado:true,conectado:mapped==='conectado',status:mapped,integracao:{...r,status:mapped}}}
  }catch(e){console.error('whatsapp_qr_status',e.message);return {configurado:true,conectado:false,status:r.status,integracao:r,aviso:'Não foi possível consultar o conector QR'}}
  return {configurado:true,conectado:false,status:r.status,integracao:r};
}
function extractQr(d){
  const q=d?.qrcode||d?.qrCode||{};
  const base64=q.base64||d?.base64||null;
  const code=q.code||d?.code||null;
  const pairingCode=q.pairingCode||d?.pairingCode||null;
  return {base64,code,pairingCode,count:q.count??d?.count??null};
}
async function start(barbeariaId){
  const name=instanceName(barbeariaId);
  let st=null;try{st=await stateByName(name)}catch{}
  if(st==='open'){
    await save(barbeariaId,{instance_name:name,status:'conectado',conectado_em:new Date()});
    return {conectado:true,status:'conectado',instance_name:name};
  }
  let d;
  if(!st){
    try{d=await call('/instance/create',{method:'POST',body:{instanceName:name,qrcode:true,integration:'WHATSAPP-BAILEYS'}})}catch(e){
      // A instância pode existir no conector mesmo sem registro local.
      d=await call(`/instance/connect/${encodeURIComponent(name)}`);
    }
  }else d=await call(`/instance/connect/${encodeURIComponent(name)}`);
  await save(barbeariaId,{instance_name:name,status:'conectando'});
  return {conectado:false,status:'conectando',instance_name:name,...extractQr(d)};
}
async function disconnect(barbeariaId){
  const r=await row(barbeariaId);if(!r)return;
  if(configured()){
    try{await call(`/instance/delete/${encodeURIComponent(r.instance_name)}`,{method:'DELETE',allow404:true})}
    catch{try{await call(`/instance/logout/${encodeURIComponent(r.instance_name)}`,{method:'DELETE',allow404:true})}catch{}}
  }
  await save(barbeariaId,{status:'desconectado',conectado_em:null,numero:null});
}

function normalizeWebhookConfig(d){
  const w=d?.webhook||d?.data?.webhook||d?.data||d||{};
  return {enabled:w.enabled!==false,url:String(w.url||''),webhookByEvents:w.webhookByEvents??w.byEvents??false,webhookBase64:w.webhookBase64??w.base64??false,events:Array.isArray(w.events)?w.events:[]};
}
async function findWebhook(barbeariaId){
  const r=await row(barbeariaId);if(!r)throw new Error('Sessão Evolution ainda não criada');if(!configured())throw new Error('Conector Evolution não configurado na infraestrutura');
  const d=await call(`/webhook/find/${encodeURIComponent(r.instance_name)}`,{allow404:true});
  return d?normalizeWebhookConfig(d):null;
}
async function setWebhook(barbeariaId,url){
  const r=await row(barbeariaId);if(!r)throw new Error('Sessão Evolution ainda não criada');if(!configured())throw new Error('Conector Evolution não configurado na infraestrutura');
  const target=String(url||'').trim();if(!target)throw new Error('URL de webhook Evolution inválida');
  const events=['MESSAGES_UPSERT','CONNECTION_UPDATE'];
  const attempts=[
    {webhook:{enabled:true,url:target,byEvents:false,base64:false,events}},
    {webhook:{enabled:true,url:target,webhookByEvents:false,webhookBase64:false,events}},
    {enabled:true,url:target,webhookByEvents:false,webhookBase64:false,events}
  ];
  let last;
  for(const body of attempts){
    try{await call(`/webhook/set/${encodeURIComponent(r.instance_name)}`,{method:'POST',body});last=null;break}catch(e){last=e}
  }
  if(last)throw last;
  const saved=await findWebhook(barbeariaId);
  if(!saved)throw new Error('Evolution não retornou a configuração do webhook após salvar');
  const hasMessages=saved.events.includes('MESSAGES_UPSERT');
  if(saved.url!==target||saved.enabled===false||saved.webhookByEvents===true||!hasMessages)throw new Error('Evolution não persistiu o webhook de entrada corretamente');
  return saved;
}
async function sendTextByInstance(name,to,text){
  if(!validPhone(to))throw new Error('Telefone inválido');
  return call(`/message/sendText/${encodeURIComponent(name)}`,{method:'POST',body:{number:digits(to),text:String(text).slice(0,4000),delay:400,linkPreview:true}});
}
async function sendText(barbeariaId,to,text){
  const r=await row(barbeariaId);if(!r||r.status!=='conectado')throw new Error('WhatsApp por QR não conectado');
  const st=await stateByName(r.instance_name);if(st!=='open'){await save(barbeariaId,{status:'desconectado'});throw new Error('Sessão QR desconectada. Escaneie novamente.')}
  return sendTextByInstance(r.instance_name,to,text);
}
module.exports={configured,status,start,disconnect,setWebhook,findWebhook,sendText,sendTextByInstance,instanceName,validPhone};
