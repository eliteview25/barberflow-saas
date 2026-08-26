const pool=require('../config/db');

function safeDetails(value){
  if(!value||typeof value!=='object')return {};
  const blocked=/senha|password|secret|token|authorization|cookie|mfa|otp/i;
  const out={};
  for(const [k,v] of Object.entries(value)){
    if(blocked.test(k))continue;
    if(v==null||['string','number','boolean'].includes(typeof v))out[k]=typeof v==='string'?v.slice(0,500):v;
  }
  return out;
}
async function audit(req,{acao,barbeariaId=null,alvoTipo=null,alvoId=null,detalhes={}},db=pool){
  if(!acao)return;
  const actor=Number(req?.usuario?.id)||null;
  const ip=String(req?.ip||'').trim()||null;
  const ua=String(req?.headers?.['user-agent']||'').slice(0,1000)||null;
  await db.query(`INSERT INTO audit_logs(actor_user_id,barbearia_id,acao,alvo_tipo,alvo_id,ip,user_agent,detalhes) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[actor,barbeariaId, String(acao).slice(0,80),alvoTipo?String(alvoTipo).slice(0,80):null,alvoId==null?null:String(alvoId).slice(0,200),ip,ua,JSON.stringify(safeDetails(detalhes))]);
}
module.exports={audit,safeDetails};
