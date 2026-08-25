const express=require('express');
const pool=require('../config/db');
const {horaParaMinutos,minutosParaHora}=require('../utils/time');
const {notificar}=require('../services/notifications');
const {criarPreferenciaAgendamento,obterPagamento}=require('../services/mercadoPago');
const router=express.Router();

async function tenant(slug){
  return (await pool.query(`
    SELECT b.id,b.nome,b.slug,b.telefone,b.email,b.endereco,b.cidade,b.estado,b.logo_url,b.banner_url,b.cor_primaria,b.cor_secundaria,b.cor_botao,b.cor_fundo,b.tema,b.descricao_publica,b.texto_boas_vindas,b.instagram,b.whatsapp_publico,b.mostrar_precos,b.mostrar_duracao,b.politica_cancelamento,
           COALESCE(b.pagamento_agendamento,'nenhum') pagamento_agendamento,
           COALESCE(b.percentual_sinal,50) percentual_sinal
    FROM barbearias b
    JOIN LATERAL (
      SELECT status,fim_trial FROM assinaturas a
      WHERE a.barbearia_id=b.id ORDER BY a.id DESC LIMIT 1
    ) ass ON true
    WHERE b.slug=$1 AND b.ativo=true
      AND (ass.status='ativa' OR (ass.status='trial' AND ass.fim_trial>=CURRENT_DATE))
  `,[slug])).rows[0]||null;
}

function valorCobranca(preco,modo,percentual){
  const total=Number(preco||0);
  if(modo==='total') return total;
  if(modo==='sinal') return Math.max(0.01,Math.round((total*Number(percentual||50)/100)*100)/100);
  return 0;
}

async function conflitoReserva(client,{barbeariaId,barbeiroId,data,horario,duracao}){
  const ag=await client.query(`
    SELECT 1 FROM agendamentos a JOIN servicos s ON s.id=a.servico_id
    WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3
      AND a.status NOT IN ('cancelado','nao_compareceu')
      AND $4::time < a.horario+(s.duracao*INTERVAL '1 minute')
      AND $4::time+($5*INTERVAL '1 minute')>a.horario
    LIMIT 1
  `,[barbeariaId,barbeiroId,data,horario,duracao]);
  if(ag.rowCount) return true;
  const rp=await client.query(`
    SELECT 1 FROM reservas_pagamento r JOIN servicos s ON s.id=r.servico_id
    WHERE r.barbearia_id=$1 AND r.barbeiro_id=$2 AND r.data=$3
      AND r.status IN ('aguardando_pagamento','pagamento_pendente')
      AND r.expira_em>NOW()
      AND $4::time < r.horario+(s.duracao*INTERVAL '1 minute')
      AND $4::time+($5*INTERVAL '1 minute')>r.horario
    LIMIT 1
  `,[barbeariaId,barbeiroId,data,horario,duracao]);
  return !!rp.rowCount;
}

async function finalizarReservaPagamento(reservaId,pagamento){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rr=await client.query(`SELECT * FROM reservas_pagamento WHERE id=$1 FOR UPDATE`,[reservaId]);
    if(!rr.rowCount){await client.query('ROLLBACK');return {ok:false,erro:'Reserva não encontrada'};}
    const r=rr.rows[0];
    if(r.agendamento_id){await client.query('COMMIT');return {ok:true,agendamento_id:r.agendamento_id,ja_confirmado:true};}
    if(!pagamento || String(pagamento.external_reference)!==`barberflow-booking:${r.id}`){await client.query('ROLLBACK');return {ok:false,erro:'Pagamento não pertence a esta reserva'};}
    await client.query(`UPDATE reservas_pagamento SET mp_payment_id=$1,mp_status=$2,atualizado_em=NOW() WHERE id=$3`,[String(pagamento.id||''),pagamento.status||null,r.id]);
    if(pagamento.status!=='approved'){
      await client.query(`UPDATE reservas_pagamento SET status=$1 WHERE id=$2`,[pagamento.status==='pending'?'pagamento_pendente':'aguardando_pagamento',r.id]);
      await client.query('COMMIT');
      return {ok:false,pendente:true,status:pagamento.status};
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${r.barbearia_id}:${r.barbeiro_id}:${r.data}`]);
    const serv=await client.query(`SELECT duracao FROM servicos WHERE id=$1 AND barbearia_id=$2`,[r.servico_id,r.barbearia_id]);
    if(!serv.rowCount) throw new Error('Serviço da reserva não existe mais');
    const dur=Number(serv.rows[0].duracao);
    const conflitos=await client.query(`
      SELECT 1 FROM agendamentos a JOIN servicos s ON s.id=a.servico_id
      WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3
        AND a.status NOT IN ('cancelado','nao_compareceu')
        AND $4::time < a.horario+(s.duracao*INTERVAL '1 minute')
        AND $4::time+($5*INTERVAL '1 minute')>a.horario
      LIMIT 1
    `,[r.barbearia_id,r.barbeiro_id,r.data,r.horario,dur]);
    if(conflitos.rowCount){
      await client.query(`UPDATE reservas_pagamento SET status='pagamento_aprovado_sem_vaga',atualizado_em=NOW() WHERE id=$1`,[r.id]);
      await client.query('COMMIT');
      notificar('pagamento_aprovado_sem_vaga',{barbearia_id:r.barbearia_id,reserva_id:r.id,payment_id:pagamento.id});
      return {ok:false,conflito:true,erro:'Pagamento aprovado, mas o horário precisa de revisão manual'};
    }
    let c=await client.query(`SELECT * FROM clientes WHERE barbearia_id=$1 AND telefone=$2 ORDER BY id LIMIT 1`,[r.barbearia_id,r.telefone]);
    if(!c.rowCount)c=await client.query(`INSERT INTO clientes(barbearia_id,nome,telefone,email) VALUES($1,$2,$3,$4) RETURNING *`,[r.barbearia_id,r.nome,r.telefone,r.email||null]);
    else await client.query(`UPDATE clientes SET nome=$1,email=COALESCE($2,email) WHERE id=$3`,[r.nome,r.email||null,c.rows[0].id]);
    const ag=await client.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem,observacoes) VALUES($1,$2,$3,$4,$5,$6,'confirmado','publico_pago',$7) RETURNING id,data,horario,status`,[r.barbearia_id,c.rows[0].id,r.barbeiro_id,r.servico_id,r.data,r.horario,`Pagamento Mercado Pago #${pagamento.id}`]);
    await client.query(`UPDATE reservas_pagamento SET status='confirmada',agendamento_id=$1,mp_payment_id=$2,mp_status=$3,atualizado_em=NOW() WHERE id=$4`,[ag.rows[0].id,String(pagamento.id||''),pagamento.status,r.id]);
    await client.query('COMMIT');
    notificar('agendamento_publico_pago',{barbearia_id:r.barbearia_id,agendamento_id:ag.rows[0].id,reserva_id:r.id,cliente:r.nome,telefone:r.telefone});
    return {ok:true,agendamento_id:ag.rows[0].id,agendamento:ag.rows[0]};
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{client.release();}
}

router.get('/:slug',async(req,res)=>{try{const b=await tenant(req.params.slug);if(!b)return res.status(404).json({erro:'Barbearia não encontrada'});const [barbeiros,servicos]=await Promise.all([pool.query(`SELECT id,nome FROM barbeiros WHERE barbearia_id=$1 AND ativo=true ORDER BY nome`,[b.id]),pool.query(`SELECT id,nome,duracao,preco FROM servicos WHERE barbearia_id=$1 AND ativo=true ORDER BY nome`,[b.id])]);res.json({barbearia:b,barbeiros:barbeiros.rows,servicos:servicos.rows});}catch(e){res.status(500).json({erro:'Erro ao carregar página pública'});}});

router.get('/:slug/horarios',async(req,res)=>{try{const b=await tenant(req.params.slug);if(!b)return res.status(404).json({erro:'Barbearia não encontrada'});const{barbeiro_id,servico_id,data}=req.query;const s=await pool.query(`SELECT duracao FROM servicos WHERE id=$1 AND barbearia_id=$2 AND ativo=true`,[servico_id,b.id]);if(!s.rowCount)return res.json([]);const dur=Number(s.rows[0].duracao);const dow=Number((await pool.query(`SELECT EXTRACT(ISODOW FROM $1::date) dia`,[data])).rows[0].dia);const exp=await pool.query(`SELECT hora_inicio,hora_fim FROM horarios_trabalho WHERE barbeiro_id=$1 AND barbearia_id=$2 AND dia_semana=$3`,[barbeiro_id,b.id,dow]);if(!exp.rowCount)return res.json([]);const [ag,rp]=await Promise.all([
  pool.query(`SELECT a.horario,s.duracao FROM agendamentos a JOIN servicos s ON s.id=a.servico_id WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3 AND a.status NOT IN ('cancelado','nao_compareceu')`,[b.id,barbeiro_id,data]),
  pool.query(`SELECT r.horario,s.duracao FROM reservas_pagamento r JOIN servicos s ON s.id=r.servico_id WHERE r.barbearia_id=$1 AND r.barbeiro_id=$2 AND r.data=$3 AND r.status IN ('aguardando_pagamento','pagamento_pendente') AND r.expira_em>NOW()`,[b.id,barbeiro_id,data])
]);const ocupados=[...ag.rows,...rp.rows];const out=[];for(let m=horaParaMinutos(exp.rows[0].hora_inicio),fim=horaParaMinutos(exp.rows[0].hora_fim);m+dur<=fim;m+=30){if(!ocupados.some(a=>m<horaParaMinutos(a.horario)+Number(a.duracao)&&m+dur>horaParaMinutos(a.horario)))out.push(minutosParaHora(m));}res.json(out);}catch(e){console.error(e);res.status(500).json({erro:'Erro ao buscar horários'});}});

router.post('/:slug/agendar',async(req,res)=>{
  const client=await pool.connect();
  try{
    const b=await tenant(req.params.slug);if(!b)return res.status(404).json({erro:'Barbearia não encontrada'});
    const{nome,telefone,email,barbeiro_id,servico_id,data,horario}=req.body;
    if(!nome||!telefone||!barbeiro_id||!servico_id||!data||!horario)return res.status(400).json({erro:'Preencha todos os campos'});
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${b.id}:${barbeiro_id}:${data}`]);
    const s=await client.query(`SELECT id,nome,duracao,preco FROM servicos WHERE id=$1 AND barbearia_id=$2 AND ativo=true`,[servico_id,b.id]);
    if(!s.rowCount){await client.query('ROLLBACK');return res.status(400).json({erro:'Serviço inválido'});}
    const dur=Number(s.rows[0].duracao);
    const dow=Number((await client.query(`SELECT EXTRACT(ISODOW FROM $1::date) dia`,[data])).rows[0].dia);
    const exp=await client.query(`SELECT hora_inicio,hora_fim FROM horarios_trabalho WHERE barbeiro_id=$1 AND barbearia_id=$2 AND dia_semana=$3`,[barbeiro_id,b.id,dow]);
    if(!exp.rowCount){await client.query('ROLLBACK');return res.status(409).json({erro:'Barbeiro não trabalha nesse dia'});}
    const valida=await client.query(`SELECT $1::time >= $2::time AND $1::time + ($3 * INTERVAL '1 minute') <= $4::time AS ok`,[horario,exp.rows[0].hora_inicio,dur,exp.rows[0].hora_fim]);
    if(!valida.rows[0].ok){await client.query('ROLLBACK');return res.status(409).json({erro:'Horário fora do expediente'});}
    if(await conflitoReserva(client,{barbeariaId:b.id,barbeiroId:barbeiro_id,data,horario,duracao:dur})){await client.query('ROLLBACK');return res.status(409).json({erro:'Esse horário acabou de ser ocupado. Escolha outro.'});}

    if(b.pagamento_agendamento==='nenhum'){
      let c=await client.query(`SELECT * FROM clientes WHERE barbearia_id=$1 AND telefone=$2 ORDER BY id LIMIT 1`,[b.id,telefone]);
      if(!c.rowCount)c=await client.query(`INSERT INTO clientes(barbearia_id,nome,telefone,email) VALUES($1,$2,$3,$4) RETURNING *`,[b.id,nome,telefone,email||null]);
      else await client.query(`UPDATE clientes SET nome=$1,email=COALESCE($2,email) WHERE id=$3`,[nome,email||null,c.rows[0].id]);
      const r=await client.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem) VALUES($1,$2,$3,$4,$5,$6,'agendado','publico') RETURNING id,data,horario,status`,[b.id,c.rows[0].id,barbeiro_id,servico_id,data,horario]);
      await client.query('COMMIT');
      notificar('agendamento_publico_criado',{barbearia_id:b.id,agendamento_id:r.rows[0].id,cliente:nome,telefone});
      return res.status(201).json({mensagem:'Agendamento realizado com sucesso',agendamento:r.rows[0],requires_payment:false});
    }

    if(!process.env.MP_ACCESS_TOKEN){await client.query('ROLLBACK');return res.status(503).json({erro:'Pagamento online ainda não configurado'});}
    const valor=valorCobranca(s.rows[0].preco,b.pagamento_agendamento,b.percentual_sinal);
    if(valor<=0){await client.query('ROLLBACK');return res.status(400).json({erro:'Serviço sem valor válido para pagamento online'});}
    const minutos=Math.max(5,Number(process.env.BOOKING_HOLD_MINUTES||15));
    const reserva=await client.query(`INSERT INTO reservas_pagamento(barbearia_id,barbeiro_id,servico_id,nome,telefone,email,data,horario,valor_total,valor_cobrado,status,expira_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'aguardando_pagamento',NOW()+($11*INTERVAL '1 minute')) RETURNING *`,[b.id,barbeiro_id,servico_id,nome,telefone,email||null,data,horario,s.rows[0].preco,valor,minutos]);
    await client.query('COMMIT');
    try{
      const mp=await criarPreferenciaAgendamento({reservaId:reserva.rows[0].id,slug:b.slug,servicoId:s.rows[0].id,servicoNome:s.rows[0].nome,valor,nome,email});
      await pool.query(`UPDATE reservas_pagamento SET mp_preference_id=$1,atualizado_em=NOW() WHERE id=$2`,[mp.id,reserva.rows[0].id]);
      return res.status(201).json({mensagem:'Horário reservado. Conclua o pagamento para confirmar.',requires_payment:true,checkout_url:mp.init_point,reserva_id:reserva.rows[0].id,expira_em:reserva.rows[0].expira_em,valor_cobrado:valor});
    }catch(e){
      await pool.query(`UPDATE reservas_pagamento SET status='falha_pagamento',atualizado_em=NOW() WHERE id=$1`,[reserva.rows[0].id]);
      console.error('Preferência pagamento agendamento:',e.data||e);
      const detalhe=e.status===429?'Mercado Pago limitou temporariamente as tentativas. Tente novamente em alguns instantes.':'Não foi possível iniciar o pagamento.';
      return res.status(502).json({erro:detalhe});
    }
  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    console.error(e);res.status(500).json({erro:e.message||'Erro ao agendar'});
  }finally{client.release();}
});

router.get('/:slug/reservas/:id',async(req,res)=>{try{const b=await tenant(req.params.slug);if(!b)return res.status(404).json({erro:'Barbearia não encontrada'});const r=await pool.query(`SELECT id,status,expira_em,mp_status,agendamento_id,valor_cobrado FROM reservas_pagamento WHERE id=$1 AND barbearia_id=$2`,[req.params.id,b.id]);if(!r.rowCount)return res.status(404).json({erro:'Reserva não encontrada'});res.json(r.rows[0]);}catch(e){res.status(500).json({erro:'Erro ao consultar reserva'});}});

router.post('/:slug/reservas/:id/sincronizar',async(req,res)=>{try{const b=await tenant(req.params.slug);if(!b)return res.status(404).json({erro:'Barbearia não encontrada'});const rr=await pool.query(`SELECT id FROM reservas_pagamento WHERE id=$1 AND barbearia_id=$2`,[req.params.id,b.id]);if(!rr.rowCount)return res.status(404).json({erro:'Reserva não encontrada'});const paymentId=String(req.body.payment_id||'');if(!paymentId)return res.status(400).json({erro:'payment_id obrigatório'});const pagamento=await obterPagamento(paymentId);const resultado=await finalizarReservaPagamento(Number(req.params.id),pagamento);res.json(resultado);}catch(e){console.error(e);res.status(502).json({erro:'Não foi possível sincronizar o pagamento'});}});

router.finalizarReservaPagamento=finalizarReservaPagamento;
module.exports=router;
