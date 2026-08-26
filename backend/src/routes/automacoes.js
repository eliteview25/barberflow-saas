const express=require('express');
const pool=require('../config/db');
const {sendTemplate}=require('../services/whatsapp');
const {sendText:sendQrText}=require('../services/whatsappQr');
const {timingSafeText}=require('../utils/security');
const router=express.Router();

function authorized(req){const configured=process.env.CRON_SECRET||'';return !!configured&&timingSafeText(req.headers['x-cron-secret']||req.headers['x-barberflow-cron'],configured)}
function spec(kind){return {
  lembrete_24h:{enabled:'lembrete_24h',template:'template_lembrete_24h',message:'mensagem_lembrete_24h',where:`a.status IN ('agendado','confirmado') AND (a.data+a.horario) BETWEEN NOW()+INTERVAL '23 hours 30 minutes' AND NOW()+INTERVAL '24 hours 30 minutes'`},
  lembrete_2h:{enabled:'lembrete_2h',template:'template_lembrete_2h',message:'mensagem_lembrete_2h',where:`a.status IN ('agendado','confirmado') AND (a.data+a.horario) BETWEEN NOW()+INTERVAL '1 hour 45 minutes' AND NOW()+INTERVAL '2 hours 15 minutes'`},
  pos_atendimento:{enabled:'pos_atendimento',template:'template_pos_atendimento',message:'mensagem_pos_atendimento',where:`a.status='concluido' AND (a.data+a.horario) BETWEEN NOW()-INTERVAL '3 hours' AND NOW()`}
}[kind]}
async function candidates(kind){
  const s=spec(kind);
  return (await pool.query(`SELECT a.id,a.barbearia_id,a.data,a.horario,c.nome cliente,c.telefone,b.nome barbeiro,sv.nome servico,
    ac.canal_lembretes,ac.${s.template} template_nome,ac.${s.message} mensagem,
    w.phone_number_id,w.business_account_id,w.numero,w.access_token_enc,w.status wa_status,
    q.instance_name,q.status qr_status
    FROM agendamentos a
    JOIN clientes c ON c.id=a.cliente_id AND c.barbearia_id=a.barbearia_id
    JOIN barbeiros b ON b.id=a.barbeiro_id AND b.barbearia_id=a.barbearia_id
    JOIN servicos sv ON sv.id=a.servico_id AND sv.barbearia_id=a.barbearia_id
    JOIN automacoes_config ac ON ac.barbearia_id=a.barbearia_id AND ac.${s.enabled}=true
    LEFT JOIN integracoes_whatsapp w ON w.barbearia_id=a.barbearia_id AND w.status='conectado'
    LEFT JOIN integracoes_whatsapp_qr q ON q.barbearia_id=a.barbearia_id AND q.status='conectado'
    JOIN assinaturas ass ON ass.id=(SELECT id FROM assinaturas x WHERE x.barbearia_id=a.barbearia_id ORDER BY id DESC LIMIT 1)
    WHERE ${s.where}
      AND ((ass.status='trial' AND ass.fim_trial>=CURRENT_DATE) OR (ass.status='ativa' AND ass.plano='premium'))
      AND ((COALESCE(ac.canal_lembretes,'cloud_api')='cloud_api' AND w.phone_number_id IS NOT NULL) OR (ac.canal_lembretes='qr' AND q.instance_name IS NOT NULL))
      AND NOT EXISTS(SELECT 1 FROM automacoes_envios e WHERE e.agendamento_id=a.id AND e.tipo=$1 AND (e.status IN ('processando','enviado') OR e.tentativas>=5 OR (e.status='erro' AND e.proxima_tentativa>NOW())))`,[kind])).rows
}
function interpolate(template,x){
  const data=String(x.data).slice(0,10).split('-').reverse().join('/');
  const hora=String(x.horario).slice(0,5);
  const defaults={
    lembrete_24h:'Olá {cliente}! 👋 Lembrete: você tem {servico} com {barbeiro} em {data}, às {hora}.',
    lembrete_2h:'Olá {cliente}! Seu horário para {servico} com {barbeiro} é hoje às {hora}. Até já! 💈',
    pos_atendimento:'Obrigado pela visita, {cliente}! Esperamos que tenha gostado do atendimento. 💈'
  };
  return String(template||defaults[x.kind]||'Lembrete BarberFlow').replace(/\{cliente\}/g,x.cliente).replace(/\{servico\}/g,x.servico).replace(/\{barbeiro\}/g,x.barbeiro).replace(/\{data\}/g,data).replace(/\{hora\}/g,hora);
}
async function claimDelivery(x,kind){
  const r=await pool.query(`INSERT INTO automacoes_envios(barbearia_id,agendamento_id,tipo,status,erro,enviado_em,tentativas,proxima_tentativa,atualizado_em)
    VALUES($1,$2,$3,'processando',NULL,NULL,1,NULL,NOW())
    ON CONFLICT(agendamento_id,tipo) DO UPDATE SET status='processando',erro=NULL,tentativas=automacoes_envios.tentativas+1,proxima_tentativa=NULL,atualizado_em=NOW()
    WHERE automacoes_envios.status='erro' AND automacoes_envios.tentativas<5 AND (automacoes_envios.proxima_tentativa IS NULL OR automacoes_envios.proxima_tentativa<=NOW())
    RETURNING id,tentativas`,[x.barbearia_id,x.id,kind]);
  return r.rows[0]||null;
}
async function processKind(kind){
  let ok=0,fail=0,skip=0;
  for(const raw of await candidates(kind)){
    const x={...raw,kind};
    let claim=null;
    try{
      claim=await claimDelivery(x,kind);if(!claim){skip++;continue}
      const data=String(x.data).slice(0,10).split('-').reverse().join('/'),hora=String(x.horario).slice(0,5);
      if((x.canal_lembretes||'cloud_api')==='qr'){
        await sendQrText(x.barbearia_id,x.telefone,interpolate(x.mensagem,x));
      }else{
        if(!x.template_nome){await pool.query(`UPDATE automacoes_envios SET status='erro',erro='Template não configurado',proxima_tentativa=NOW()+INTERVAL '1 day',atualizado_em=NOW() WHERE id=$1`,[claim.id]);skip++;continue}
        await sendTemplate(x,x.telefone,x.template_nome,[x.cliente,x.servico,x.barbeiro,data,hora]);
      }
      await pool.query(`UPDATE automacoes_envios SET status='enviado',erro=NULL,enviado_em=NOW(),proxima_tentativa=NULL,atualizado_em=NOW() WHERE id=$1`,[claim.id]);ok++
    }catch(e){
      fail++;
      if(claim)await pool.query(`UPDATE automacoes_envios SET status='erro',erro=$1,proxima_tentativa=CASE WHEN tentativas<5 THEN NOW()+(LEAST(60,POWER(2,tentativas)::int)*INTERVAL '1 minute') ELSE NULL END,atualizado_em=NOW() WHERE id=$2`,[String(e.message).slice(0,500),claim.id]);
      console.error('Automação',kind,x.id,e.message)
    }
  }
  return{kind,ok,fail,skip}
}
router.post('/processar',async(req,res)=>{if(!authorized(req))return res.status(401).json({erro:'Cron não autorizado'});try{res.json({resultados:await Promise.all(['lembrete_24h','lembrete_2h','pos_atendimento'].map(processKind)),processado_em:new Date().toISOString()})}catch(e){console.error(e);res.status(500).json({erro:'Erro ao processar automações'})}});
module.exports=router;
