const pool=require('../config/db');const {externalSignal}=require('../utils/http');

function base(){return String(process.env.EVOLUTION_API_URL||'').replace(/\/$/,'')}
function key(){return process.env.EVOLUTION_API_KEY||''}
function configured(){return !!(base()&&key())}
function instanceName(barbeariaId){return `barberflow${Number(barbeariaId)}`}
function digits(v){return String(v||'').replace(/\D/g,'').slice(-15)}
function validPhone(v){const d=digits(v);return d.length>=10&&d.length<=15}

async function call(path,{method='GET',body,allow404=false}={}){
  if(!configured())throw new Error('Conector QR não configurado na infraestrutura do BarberFlow');
  const r=await fetch(`${base()}${path}`,{
    method,
    headers:{apikey:key(),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
    signal:externalSignal()
  });
  let d={};try{d=await r.json()}catch{}
  if(r.status===404&&allow404)return null;
  if(!r.ok)throw new Error(d?.response?.message||d?.message||d?.error||`Conector QR respondeu ${r.status}`);
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
  }catch(e){return {configurado:true,conectado:false,status:r.status,integracao:r,aviso:e.message}}
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

async function setWebhook(barbeariaId,url){
  const r=await row(barbeariaId);if(!r)throw new Error('Sessão Evolution ainda não criada');if(!configured())throw new Error('Conector Evolution não configurado na infraestrutura');
  const payload={enabled:true,url:String(url||''),webhookByEvents:true,webhookBase64:false,events:['MESSAGES_UPSERT','CONNECTION_UPDATE']};
  return call(`/webhook/set/${encodeURIComponent(r.instance_name)}`,{method:'POST',body:payload});
}
async function sendTextByInstance(name,to,text){
  if(!validPhone(to))throw new Error('Telefone inválido');
  return call(`/message/sendText/${encodeURIComponent(name)}`,{method:'POST',body:{number:digits(to),textMessage:{text:String(text).slice(0,4000)},delay:400,linkPreview:true}});
}
async function sendText(barbeariaId,to,text){
  const r=await row(barbeariaId);if(!r||r.status!=='conectado')throw new Error('WhatsApp por QR não conectado');
  const st=await stateByName(r.instance_name);if(st!=='open'){await save(barbeariaId,{status:'desconectado'});throw new Error('Sessão QR desconectada. Escaneie novamente.')}
  return sendTextByInstance(r.instance_name,to,text);
}
module.exports={configured,status,start,disconnect,setWebhook,sendText,sendTextByInstance,instanceName,validPhone};
