const pool=require('../config/db');
const {lockSlot,upsertClient}=require('./booking');
const {cleanText}=require('../utils/validation');
const {notificar}=require('./notifications');
const {recordMarketingConversion}=require('./marketing');
const {sendAppointmentTracking,formatTrackingCode}=require('./bookingTracking');

function paymentForm(payment){
  const method=String(payment?.payment_method_id||'').toLowerCase(),type=String(payment?.payment_type_id||'').toLowerCase();
  if(method==='pix')return 'pix';
  if(['credit_card','debit_card','prepaid_card'].includes(type))return 'cartao';
  return 'mercado_pago';
}

function paymentMatchesReservation(payment,reservation){
  if(!payment||String(payment.external_reference||'')!==`barberflow-booking:${reservation.id}`)return {ok:false,error:'Pagamento não pertence a esta reserva'};
  const currency=String(payment.currency_id||payment.currency||'BRL').toUpperCase();if(currency&&currency!=='BRL')return {ok:false,error:'Moeda do pagamento inválida'};
  const amount=Number(payment.transaction_amount??payment.transaction_details?.total_paid_amount??0);
  const expected=Number(reservation.valor_cobrado||0);
  if(payment.status==='approved'&&(!Number.isFinite(amount)||Math.abs(amount-expected)>0.011))return {ok:false,error:'Valor pago não corresponde ao valor esperado'};
  return {ok:true,amount};
}
async function hasConflict(db,r,dur){
  const q=await db.query(`SELECT 1 FROM agendamentos a JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3 AND a.status IN ('agendado','confirmado','em_atendimento','concluido') AND $4::time<a.horario+(s.duracao*INTERVAL '1 minute') AND $4::time+($5*INTERVAL '1 minute')>a.horario LIMIT 1`,[r.barbearia_id,r.barbeiro_id,r.data,r.horario,dur]);return !!q.rowCount;
}
async function finalizePaidReservation(reservaId,payment){
  const db=await pool.connect();try{await db.query('BEGIN');const rr=await db.query(`SELECT * FROM reservas_pagamento WHERE id=$1 FOR UPDATE`,[reservaId]);if(!rr.rowCount){await db.query('ROLLBACK');return {ok:false,error:'Reserva não encontrada'}}const r=rr.rows[0];if(r.agendamento_id){await db.query('COMMIT');return {ok:true,appointment_id:r.agendamento_id,already_confirmed:true}}
    const check=paymentMatchesReservation(payment,r);if(!check.ok){await db.query('ROLLBACK');return check;}
    if(payment.status!=='approved'){
      const mpStatus=String(payment.status||'unknown');
      const pending=['pending','in_process','in_mediation'].includes(mpStatus);
      const localStatus=pending?'pagamento_pendente':['cancelled','rejected','refunded','charged_back'].includes(mpStatus)?'falha_pagamento':'pagamento_pendente';
      await db.query(`UPDATE reservas_pagamento SET mp_payment_id=$1,mp_status=$2,status=$3,atualizado_em=NOW() WHERE id=$4`,[String(payment.id||''),mpStatus,localStatus,r.id]);
      await db.query('COMMIT');
      return {ok:false,pending,status:mpStatus,error:pending?null:'Pagamento não aprovado'};
    }
    // A payment id may never confirm two independent reservations.
    const used=await db.query(`SELECT id FROM reservas_pagamento WHERE mp_payment_id=$1 AND id<>$2 LIMIT 1`,[String(payment.id),r.id]);if(used.rowCount){await db.query('ROLLBACK');return {ok:false,error:'Pagamento já vinculado a outra reserva'};}
    await db.query(`UPDATE reservas_pagamento SET mp_payment_id=$1,mp_status=$2,atualizado_em=NOW() WHERE id=$3`,[String(payment.id),payment.status,r.id]);
    await lockSlot(db,r.barbearia_id,r.barbeiro_id,r.data);const serv=await db.query(`SELECT id,nome,duracao FROM servicos WHERE id=$1 AND barbearia_id=$2`,[r.servico_id,r.barbearia_id]);if(!serv.rowCount)throw new Error('Serviço da reserva não existe mais');
    if(await hasConflict(db,r,Number(serv.rows[0].duracao))){await db.query(`UPDATE reservas_pagamento SET status='pagamento_aprovado_sem_vaga',atualizado_em=NOW() WHERE id=$1`,[r.id]);await db.query('COMMIT');notificar('pagamento_aprovado_sem_vaga',{barbearia_id:r.barbearia_id,reserva_id:r.id,payment_id:payment.id});return {ok:false,conflict:true,error:'Pagamento aprovado, mas o horário requer revisão manual'};}
    const client=await upsertClient(db,{barbeariaId:r.barbearia_id,nome:r.nome,telefone:r.telefone,email:r.email,marketingOptIn:r.marketing_opt_in===true,marketingOrigem:'agendamento_publico'});const paid=Math.round(Number(check.amount)*100)/100,total=Number(r.valor_total||0);const payStatus=paid+0.009>=total?'pago':'parcial';
    const forma=paymentForm(payment);const ag=await db.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem,observacoes,forma_pagamento,status_pagamento,valor_cobrado,valor_pago,valor_servico,valor_final,marketing_link_id,marketing_campanha_id) VALUES($1,$2,$3,$4,$5,$6,'confirmado','publico_pago',$7,$8,$9,$10,$11,$12,$12,$13,$14) RETURNING id,public_token,tracking_code,data,horario,status,status_pagamento,forma_pagamento`,[r.barbearia_id,client.id,r.barbeiro_id,r.servico_id,r.data,r.horario,cleanText(`Pagamento Mercado Pago #${payment.id}`,1000),forma,payStatus,Number(r.valor_cobrado),paid,total,r.marketing_link_id||null,r.marketing_campanha_id||null]);
    await db.query(`UPDATE reservas_pagamento SET status='confirmada',agendamento_id=$1,mp_payment_id=$2,mp_status=$3,atualizado_em=NOW() WHERE id=$4`,[ag.rows[0].id,String(payment.id),payment.status,r.id]);if(r.marketing_link_id||r.marketing_campanha_id)await recordMarketingConversion(db,{linkId:r.marketing_link_id,campaignId:r.marketing_campanha_id,revenue:total});await db.query('COMMIT');notificar('agendamento_publico_pago',{barbearia_id:r.barbearia_id,agendamento_id:ag.rows[0].id,reserva_id:r.id,cliente:r.nome,telefone:r.telefone});sendAppointmentTracking({barbeariaId:r.barbearia_id,appointmentId:ag.rows[0].id,confirmed:true}).catch(()=>{});return {ok:true,appointment_id:ag.rows[0].id,appointment:{...ag.rows[0],codigo:formatTrackingCode(ag.rows[0].tracking_code)}};
  }catch(e){try{await db.query('ROLLBACK')}catch{}throw e}finally{db.release()}}

async function confirmManualPix({barbeariaId,reservaId,confirmedBy}){
  const db=await pool.connect();try{await db.query('BEGIN');const rr=await db.query(`SELECT * FROM reservas_pagamento WHERE id=$1 AND barbearia_id=$2 FOR UPDATE`,[reservaId,barbeariaId]);if(!rr.rowCount){await db.query('ROLLBACK');return {ok:false,status:404,error:'Reserva não encontrada'}}const r=rr.rows[0];if(r.forma_pagamento!=='pix_manual'){await db.query('ROLLBACK');return {ok:false,status:400,error:'Reserva não é Pix manual'}}if(r.agendamento_id){await db.query('COMMIT');return {ok:true,appointment_id:r.agendamento_id,already_confirmed:true}}
    if(!['aguardando_pix_manual','pagamento_pendente'].includes(r.status)){await db.query('ROLLBACK');return {ok:false,status:409,error:'Reserva não está aguardando confirmação de Pix'}}
    await lockSlot(db,r.barbearia_id,r.barbeiro_id,r.data);const serv=await db.query(`SELECT duracao FROM servicos WHERE id=$1 AND barbearia_id=$2`,[r.servico_id,r.barbearia_id]);if(!serv.rowCount)throw new Error('Serviço inválido');if(await hasConflict(db,r,Number(serv.rows[0].duracao))){await db.query(`UPDATE reservas_pagamento SET status='pagamento_aprovado_sem_vaga',atualizado_em=NOW() WHERE id=$1`,[r.id]);await db.query('COMMIT');return {ok:false,status:409,error:'Pagamento confirmado, mas o horário já foi ocupado. Faça revisão manual.'}}
    const client=await upsertClient(db,{barbeariaId:r.barbearia_id,nome:r.nome,telefone:r.telefone,email:r.email,marketingOptIn:r.marketing_opt_in===true,marketingOrigem:'agendamento_publico'});const total=Number(r.valor_total||0),paid=Number(r.valor_cobrado||0),payStatus=paid+0.009>=total?'pago':'parcial';const ag=await db.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem,observacoes,forma_pagamento,status_pagamento,valor_cobrado,valor_pago,valor_servico,valor_final,marketing_link_id,marketing_campanha_id) VALUES($1,$2,$3,$4,$5,$6,'confirmado','publico_pix_manual',$7,'pix_manual',$8,$9,$9,$10,$10,$11,$12) RETURNING *`,[r.barbearia_id,client.id,r.barbeiro_id,r.servico_id,r.data,r.horario,`Pix manual confirmado por usuário ${confirmedBy||'equipe'}`,payStatus,paid,total,r.marketing_link_id||null,r.marketing_campanha_id||null]);await db.query(`UPDATE reservas_pagamento SET status='confirmada',agendamento_id=$1,atualizado_em=NOW() WHERE id=$2`,[ag.rows[0].id,r.id]);if(r.marketing_link_id||r.marketing_campanha_id)await recordMarketingConversion(db,{linkId:r.marketing_link_id,campaignId:r.marketing_campanha_id,revenue:total});await db.query('COMMIT');notificar('agendamento_pix_confirmado',{barbearia_id:r.barbearia_id,agendamento_id:ag.rows[0].id,reserva_id:r.id}).catch(()=>{});const whatsapp=await sendAppointmentTracking({barbeariaId:r.barbearia_id,appointmentId:ag.rows[0].id,confirmed:true,paymentConfirmed:true});return {ok:true,appointment_id:ag.rows[0].id,appointment:{...ag.rows[0],codigo:formatTrackingCode(ag.rows[0].tracking_code)},whatsapp};
  }catch(e){try{await db.query('ROLLBACK')}catch{}throw e}finally{db.release()}}
module.exports={finalizePaidReservation,confirmManualPix,paymentMatchesReservation,paymentForm};
