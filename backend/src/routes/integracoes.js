const express = require('express');
const pool = require('../config/db');
const { obterAssinatura, obterPagamentoAutorizado, obterPagamento, validarWebhook } = require('../services/mercadoPago');
const { getSellerAccessToken } = require('../services/mercadoPagoOAuth');
const router = express.Router();

function statusLocal(statusMp) {
  if (statusMp === 'authorized') return 'ativa';
  if (statusMp === 'canceled') return 'cancelada';
  if (statusMp === 'paused') return 'inadimplente';
  return null;
}

async function sincronizarPreapproval(id) {
  const assinaturaMp = await obterAssinatura(id);
  const ref = String(assinaturaMp.external_reference || '');
  const match = ref.match(/^barberflow:(\d+):(starter|pro|premium)$/);
  if (!match) return;
  const barbeariaId = Number(match[1]);
  const plano = match[2];
  const local = statusLocal(assinaturaMp.status);
  await pool.query(`
    UPDATE assinaturas
    SET plano=$1,status=COALESCE($2,status),provedor='mercadopago',referencia_externa=$3,
        provedor_status=$4,checkout_url=COALESCE($5,checkout_url),proxima_cobranca=$6,atualizado_em=NOW()
    WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$7 ORDER BY id DESC LIMIT 1)
  `,[plano,local,id,assinaturaMp.status,assinaturaMp.init_point||null,assinaturaMp.next_payment_date?String(assinaturaMp.next_payment_date).slice(0,10):null,barbeariaId]);
}

async function finalizarReservaPagamento(reservaId,pagamento){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rr=await client.query(`SELECT * FROM reservas_pagamento WHERE id=$1 FOR UPDATE`,[reservaId]);
    if(!rr.rowCount){await client.query('ROLLBACK');return;}
    const r=rr.rows[0];
    if(r.agendamento_id){await client.query('COMMIT');return;}
    if(String(pagamento.external_reference||'')!==`barberflow-booking:${r.id}`){await client.query('ROLLBACK');return;}
    await client.query(`UPDATE reservas_pagamento SET mp_payment_id=$1,mp_status=$2,atualizado_em=NOW() WHERE id=$3`,[String(pagamento.id||''),pagamento.status||null,r.id]);
    if(pagamento.status!=='approved'){
      await client.query(`UPDATE reservas_pagamento SET status=$1 WHERE id=$2`,[pagamento.status==='pending'?'pagamento_pendente':'aguardando_pagamento',r.id]);
      await client.query('COMMIT');return;
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${r.barbearia_id}:${r.barbeiro_id}:${r.data}`]);
    const serv=await client.query(`SELECT duracao FROM servicos WHERE id=$1 AND barbearia_id=$2`,[r.servico_id,r.barbearia_id]);
    if(!serv.rowCount)throw new Error('Serviço da reserva não existe');
    const dur=Number(serv.rows[0].duracao);
    const conflito=await client.query(`SELECT 1 FROM agendamentos a JOIN servicos s ON s.id=a.servico_id WHERE a.barbearia_id=$1 AND a.barbeiro_id=$2 AND a.data=$3 AND a.status NOT IN ('cancelado','nao_compareceu') AND $4::time<a.horario+(s.duracao*INTERVAL '1 minute') AND $4::time+($5*INTERVAL '1 minute')>a.horario LIMIT 1`,[r.barbearia_id,r.barbeiro_id,r.data,r.horario,dur]);
    if(conflito.rowCount){await client.query(`UPDATE reservas_pagamento SET status='pagamento_aprovado_sem_vaga',atualizado_em=NOW() WHERE id=$1`,[r.id]);await client.query('COMMIT');console.error('Pagamento aprovado sem vaga. Reserva:',r.id,'Payment:',pagamento.id);return;}
    let c=await client.query(`SELECT * FROM clientes WHERE barbearia_id=$1 AND telefone=$2 ORDER BY id LIMIT 1`,[r.barbearia_id,r.telefone]);
    if(!c.rowCount)c=await client.query(`INSERT INTO clientes(barbearia_id,nome,telefone,email) VALUES($1,$2,$3,$4) RETURNING *`,[r.barbearia_id,r.nome,r.telefone,r.email||null]);
    else await client.query(`UPDATE clientes SET nome=$1,email=COALESCE($2,email) WHERE id=$3`,[r.nome,r.email||null,c.rows[0].id]);
    const ag=await client.query(`INSERT INTO agendamentos(barbearia_id,cliente_id,barbeiro_id,servico_id,data,horario,status,origem,observacoes,forma_pagamento,status_pagamento,valor_cobrado,valor_pago) VALUES($1,$2,$3,$4,$5,$6,'confirmado','publico_pago',$7,'mercado_pago','pago',$8,$8) RETURNING id`,[r.barbearia_id,c.rows[0].id,r.barbeiro_id,r.servico_id,r.data,r.horario,`Pagamento Mercado Pago #${pagamento.id}`,r.valor_cobrado]);
    await client.query(`UPDATE reservas_pagamento SET status='confirmada',agendamento_id=$1,mp_payment_id=$2,mp_status=$3,atualizado_em=NOW() WHERE id=$4`,[ag.rows[0].id,String(pagamento.id||''),pagamento.status,r.id]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

router.post('/mercadopago', async (req,res) => {
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  const secret = process.env.MP_WEBHOOK_SECRET || '';
  const ok = validarWebhook({xSignature:req.headers['x-signature'],xRequestId:req.headers['x-request-id'],dataId,secret});
  if (secret && !ok) return res.status(401).json({erro:'Assinatura do webhook inválida'});
  res.sendStatus(200);
  try {
    const type = req.query.type || req.body?.type || req.query.topic;
    if (type === 'subscription_preapproval' && dataId) {await sincronizarPreapproval(dataId);return;}
    if (type === 'subscription_authorized_payment' && dataId) {
      const pagamento=await obterPagamentoAutorizado(dataId);
      if(pagamento?.preapproval_id) await sincronizarPreapproval(pagamento.preapproval_id);
      try{
        const preId=pagamento?.preapproval_id||null;
        const ar=preId?await pool.query(`SELECT id,barbearia_id,plano FROM assinaturas WHERE referencia_externa=$1 ORDER BY id DESC LIMIT 1`,[preId]):{rowCount:0,rows:[]};
        if(ar.rowCount){
          const a=ar.rows[0];
          const valor=Number(pagamento.transaction_amount??pagamento.amount??pagamento.transaction_details?.total_paid_amount??0);
          const pagoEm=pagamento.date_approved||pagamento.date_created||new Date().toISOString();
          const status=String(pagamento.status||'').toLowerCase()==='approved'?'pago':String(pagamento.status||'pendente');
          await pool.query(`INSERT INTO assinaturas_cobrancas(barbearia_id,assinatura_id,competencia,valor,status,vencimento,pago_em,provedor,referencia_externa) VALUES($1,$2,date_trunc('month',$3::timestamptz)::date,$4,$5,$3::timestamptz::date,CASE WHEN $5='pago' THEN $3::timestamptz ELSE NULL END,'mercadopago',$6) ON CONFLICT (provedor,referencia_externa) WHERE referencia_externa IS NOT NULL DO UPDATE SET valor=EXCLUDED.valor,status=EXCLUDED.status,pago_em=EXCLUDED.pago_em,atualizado_em=NOW()`,[a.barbearia_id,a.id,pagoEm,valor,status,String(pagamento.id||dataId)]);
        }
      }catch(logErr){console.error('Erro registrando cobrança SaaS:',logErr.message)}
      return;
    }
    if ((type === 'payment' || type === 'payments') && dataId) {
      const barbeariaId=Number(req.query.barbearia_id||0);
      const reservaId=Number(req.query.reserva_id||0);
      let pagamento;
      if(barbeariaId){
        const sellerToken=await getSellerAccessToken(barbeariaId);
        pagamento=await obterPagamento(dataId,sellerToken);
      }else{
        pagamento=await obterPagamento(dataId);
      }
      const m=String(pagamento.external_reference||'').match(/^barberflow-booking:(\d+)$/);
      const rid=m?Number(m[1]):reservaId;
      if(rid) await finalizarReservaPagamento(rid,pagamento);
    }
  } catch (e) {console.error('Erro processando webhook Mercado Pago:', e.data||e.message);}
});

router.post('/billing', async (req,res) => {
  if(!process.env.BILLING_WEBHOOK_SECRET || req.headers['x-barberflow-secret']!==process.env.BILLING_WEBHOOK_SECRET) return res.status(401).json({erro:'Webhook não autorizado'});
  const {barbearia_id,status,plano,referencia_externa,proxima_cobranca,provedor}=req.body;
  if(!barbearia_id||!['trial','ativa','inadimplente','cancelada'].includes(status))return res.status(400).json({erro:'Payload inválido'});
  const r=await pool.query(`UPDATE assinaturas SET status=$1,plano=COALESCE($2,plano),referencia_externa=COALESCE($3,referencia_externa),proxima_cobranca=COALESCE($4,proxima_cobranca),provedor=COALESCE($5,provedor),atualizado_em=NOW() WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$6 ORDER BY id DESC LIMIT 1) RETURNING *`,[status,plano||null,referencia_externa||null,proxima_cobranca||null,provedor||null,barbearia_id]);
  if(!r.rowCount)return res.status(404).json({erro:'Assinatura não encontrada'});res.json(r.rows[0]);
});
module.exports=router;
