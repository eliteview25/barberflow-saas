const express=require('express');
const pool=require('../config/db');
const {sendTemplate}=require('../services/whatsapp');
const {sendText:sendQrText}=require('../services/whatsappQr');
const router=express.Router();

function authorized(req){return process.env.CRON_SECRET&&req.headers['x-barberflow-cron']===process.env.CRON_SECRET}
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
    JOIN clientes c ON c.id=a.cliente_id
    JOIN barbeiros b ON b.id=a.barbeiro_id
    JOIN servicos sv ON sv.id=a.servico_id
    JOIN automacoes_config ac ON ac.barbearia_id=a.barbearia_id AND ac.${s.enabled}=true
    LEFT JOIN integracoes_whatsapp w ON w.barbearia_id=a.barbearia_id AND w.status='conectado'
    LEFT JOIN integracoes_whatsapp_qr q ON q.barbearia_id=a.barbearia_id AND q.status='conectado'
    JOIN assinaturas ass ON ass.id=(SELECT id FROM assinaturas x WHERE x.barbearia_id=a.barbearia_id ORDER BY id DESC LIMIT 1)
    WHERE ${s.where}
      AND ((ass.status='trial' AND ass.fim_trial>=CURRENT_DATE) OR (ass.status='ativa' AND ass.plano='premium'))
      AND ((COALESCE(ac.canal_lembretes,'cloud_api')='cloud_api' AND w.phone_number_id IS NOT NULL) OR (ac.canal_lembretes='qr' AND q.instance_name IS NOT NULL))
      AND NOT EXISTS(SELECT 1 FROM automacoes_envios e WHERE e.agendamento_id=a.id AND e.tipo=$1)`,[kind])).rows
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
async function processKind(kind){
  let ok=0,fail=0,skip=0;
  for(const raw of await candidates(kind)){
    const x={...raw,kind};
    try{
      const data=String(x.data).slice(0,10).split('-').reverse().join('/'),hora=String(x.horario).slice(0,5);
      if((x.canal_lembretes||'cloud_api')==='qr'){
        await sendQrText(x.barbearia_id,x.telefone,interpolate(x.mensagem,x));
      }else{
        if(!x.template_nome){skip++;continue}
        await sendTemplate(x,x.telefone,x.template_nome,[x.cliente,x.servico,x.barbeiro,data,hora]);
      }
      await pool.query(`INSERT INTO automacoes_envios(barbearia_id,agendamento_id,tipo,status,enviado_em) VALUES($1,$2,$3,'enviado',NOW()) ON CONFLICT(agendamento_id,tipo) DO NOTHING`,[x.barbearia_id,x.id,kind]);ok++
    }catch(e){
      fail++;
      await pool.query(`INSERT INTO automacoes_envios(barbearia_id,agendamento_id,tipo,status,erro,enviado_em) VALUES($1,$2,$3,'erro',$4,NOW()) ON CONFLICT(agendamento_id,tipo) DO UPDATE SET status='erro',erro=$4,enviado_em=NOW()`,[x.barbearia_id,x.id,kind,String(e.message).slice(0,500)]);
      console.error('Automação',kind,x.id,e.message)
    }
  }
  return{kind,ok,fail,skip}
}
router.post('/processar',async(req,res)=>{if(!authorized(req))return res.status(401).json({erro:'Cron não autorizado'});try{res.json({resultados:await Promise.all(['lembrete_24h','lembrete_2h','pos_atendimento'].map(processKind)),processado_em:new Date().toISOString()})}catch(e){console.error(e);res.status(500).json({erro:'Erro ao processar automações'})}});
module.exports=router;
