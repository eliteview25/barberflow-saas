const pool=require('../config/db');
const {dateWithinBookingWindow,hhmm,intId,cleanText}=require('../utils/validation');
const {normalizePhone,validEmail}=require('../utils/security');

const BUSY_STATUSES=['agendado','confirmado','em_atendimento','concluido'];
const HOLD_STATUSES=['aguardando_pagamento','pagamento_pendente','aguardando_pix_manual'];

async function lockSlot(db,barbeariaId,barbeiroId,data){
  await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${barbeariaId}:${barbeiroId}:${data}`]);
}
async function slotContext(db,{barbeariaId,barbeiroId,servicoId,data,horario,ignoreAppointmentId=null}){
  barbeiroId=intId(barbeiroId);servicoId=intId(servicoId);data=String(data||'');horario=hhmm(horario);
  if(!barbeiroId||!servicoId||!horario||!dateWithinBookingWindow(data))return {ok:false,code:'DADOS_INVALIDOS',error:'Data, horário, barbeiro ou serviço inválido'};
  const [serv,barb]=await Promise.all([
    db.query(`SELECT id,nome,duracao,preco,ativo FROM servicos WHERE id=$1 AND barbearia_id=$2`,[servicoId,barbeariaId]),
    db.query(`SELECT id,nome,ativo FROM barbeiros WHERE id=$1 AND barbearia_id=$2`,[barbeiroId,barbeariaId])
  ]);
  if(!serv.rowCount||serv.rows[0].ativo!==true)return {ok:false,code:'SERVICO_INVALIDO',error:'Serviço indisponível'};
  if(!barb.rowCount||barb.rows[0].ativo!==true)return {ok:false,code:'BARBEIRO_INVALIDO',error:'Barbeiro indisponível'};
  const dow=Number((await db.query(`SELECT EXTRACT(ISODOW FROM $1::date) dia`,[data])).rows[0].dia);
  const exp=await db.query(`SELECT hora_inicio,hora_fim FROM horarios_trabalho WHERE barbearia_id=$1 AND barbeiro_id=$2 AND dia_semana=$3`,[barbeariaId,barbeiroId,dow]);
  if(!exp.rowCount)return {ok:false,code:'FORA_EXPEDIENTE',error:'Barbeiro não trabalha nessa data'};
  const dur=Number(serv.rows[0].duracao);
  const valid=(await db.query(`SELECT $1::time >= $2::time AND $1::time+($3*INTERVAL '1 minute') <= $4::time ok`,[horario,exp.rows[0].hora_inicio,dur,exp.rows[0].hora_fim])).rows[0].ok;
  if(!valid)return {ok:false,code:'FORA_EXPEDIENTE',error:'Horário fora do expediente'};
  const vals=[barbeariaId,barbeiroId,data,horario,dur];let ignore='';
  if(ignoreAppointmentId){vals.push(intId(ignoreAppointmentId));ignore=` AND a.id<>$6`;}
  const conflict=await db.query(`SELECT 1 FROM agendamentos a JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3 AND a.status=ANY(${'ARRAY['+BUSY_STATUSES.map((_,i)=>`'${BUSY_STATUSES[i]}'`).join(',')+']'}) ${ignore} AND $4::time<a.horario+(s.duracao*INTERVAL '1 minute') AND $4::time+($5*INTERVAL '1 minute')>a.horario LIMIT 1`,vals);
  if(conflict.rowCount)return {ok:false,code:'CONFLITO',error:'Horário indisponível'};
  const hold=await db.query(`SELECT 1 FROM reservas_pagamento r JOIN servicos s ON s.id=r.servico_id AND s.barbearia_id=r.barbearia_id WHERE r.barbearia_id=$1 AND r.barbeiro_id=$2 AND r.data=$3 AND r.status=ANY($6::text[]) AND r.expira_em>NOW() AND $4::time<r.horario+(s.duracao*INTERVAL '1 minute') AND $4::time+($5*INTERVAL '1 minute')>r.horario LIMIT 1`,[barbeariaId,barbeiroId,data,horario,dur,HOLD_STATUSES]);
  if(hold.rowCount)return {ok:false,code:'CONFLITO',error:'Horário temporariamente reservado'};
  return {ok:true,barbeiro:barb.rows[0],servico:serv.rows[0],data,horario,duracao:dur};
}
async function upsertClient(db,{barbeariaId,nome,telefone,email,marketingOptIn=false,marketingOrigem='publico'}){
  nome=cleanText(nome,120,{required:true});telefone=normalizePhone(telefone);email=String(email||'').trim().toLowerCase()||null;
  if(!nome||telefone.length<10||telefone.length>15)throw Object.assign(new Error('Nome ou telefone inválido'),{code:'DADOS_INVALIDOS'});
  if(email&&!validEmail(email))throw Object.assign(new Error('E-mail inválido'),{code:'DADOS_INVALIDOS'});
  await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`client:${barbeariaId}:${telefone}`]);
  let r=await db.query(`SELECT * FROM clientes WHERE barbearia_id=$1 AND regexp_replace(telefone,'\\D','','g')=$2 ORDER BY id LIMIT 1 FOR UPDATE`,[barbeariaId,telefone]);
  if(!r.rowCount)r=await db.query(`INSERT INTO clientes(barbearia_id,nome,telefone,email,marketing_opt_in,marketing_opt_in_em,marketing_opt_in_origem) VALUES($1,$2,$3,$4,$5,CASE WHEN $5 THEN NOW() ELSE NULL END,CASE WHEN $5 THEN $6 ELSE NULL END) RETURNING *`,[barbeariaId,nome,telefone,email,!!marketingOptIn,marketingOrigem]);
  else {await db.query(`UPDATE clientes SET nome=$1,email=COALESCE($2,email),marketing_opt_in=CASE WHEN $5 THEN true ELSE marketing_opt_in END,marketing_opt_in_em=CASE WHEN $5 AND marketing_opt_in=false THEN NOW() ELSE marketing_opt_in_em END,marketing_opt_in_origem=CASE WHEN $5 AND marketing_opt_in=false THEN $6 ELSE marketing_opt_in_origem END,marketing_opt_out_em=CASE WHEN $5 THEN NULL ELSE marketing_opt_out_em END WHERE id=$3 AND barbearia_id=$4`,[nome,email,r.rows[0].id,barbeariaId,!!marketingOptIn,marketingOrigem]);r.rows[0]={...r.rows[0],nome,email:email||r.rows[0].email,marketing_opt_in:marketingOptIn?true:r.rows[0].marketing_opt_in};}
  return r.rows[0];
}
async function createTrustedAppointment({barbeariaId,nome,telefone,email,barbeiroId,servicoId,data,horario,origem='interno',formaPagamento='nao_informado',statusPagamento='nao_exigido',status='agendado',valorCobrado=0,valorPago=0,observacoes=null}){
  const db=await pool.connect();try{await db.query('BEGIN');await lockSlot(db,barbeariaId,barbeiroId,data);const ctx=await slotContext(db,{barbeariaId,barbeiroId,servicoId,data,horario});if(!ctx.ok){await db.query('ROLLBACK');return ctx;}
    const cliente=await upsertClient(db,{barbeariaId,nome,telefone,email});const preco=Number(ctx.servico.preco||0);
    const r=await db.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem,observacoes,forma_pagamento,status_pagamento,valor_cobrado,valor_pago,valor_servico,valor_final) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,[barbeariaId,cliente.id,ctx.barbeiro.id,ctx.servico.id,ctx.data,ctx.horario,status,cleanText(origem,30)||'interno',cleanText(observacoes,1000)||null,formaPagamento,statusPagamento,Number(valorCobrado||0),Number(valorPago||0),preco]);
    await db.query('COMMIT');return {ok:true,appointment:r.rows[0],client:cliente,service:ctx.servico,barber:ctx.barbeiro};
  }catch(e){try{await db.query('ROLLBACK')}catch{}throw e}finally{db.release()}}

module.exports={BUSY_STATUSES,HOLD_STATUSES,lockSlot,slotContext,upsertClient,createTrustedAppointment};
