const pool=require('../config/db');
const {obterAssinatura,obterPagamentoAutorizado,obterPagamento}=require('./mercadoPago');
const {getSellerAccessToken}=require('./mercadoPagoOAuth');
const {finalizePaidReservation}=require('./reservations');
const {integrationByPhoneId,processIncoming}=require('./whatsapp');
const {aplicarPagamentoPix}=require('./subscriptionPayments');
const {markOrderPayment}=require('./storeCommerce');

function mpLocalStatus(providerStatus,currentStatus){
  if(providerStatus==='authorized')return 'ativa';
  if(providerStatus==='paused')return 'inadimplente';
  if(providerStatus==='canceled')return currentStatus==='trial'?'trial':'cancelada';
  return currentStatus;
}
async function syncPreapproval(id){
  const mp=await obterAssinatura(id);const ref=String(mp.external_reference||''),parsed=ref.match(/^barberflow:(\d+):(starter|pro|premium)$/);
  let cur=(await pool.query(`SELECT id,barbearia_id,status,plano,plano_pendente,referencia_externa FROM assinaturas WHERE referencia_externa=$1 ORDER BY id DESC LIMIT 1`,[String(id)])).rows[0];
  if(!cur){if(!parsed)return;const tenantId=Number(parsed[1]);cur=(await pool.query(`SELECT id,barbearia_id,status,plano,plano_pendente,referencia_externa FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[tenantId])).rows[0];if(!cur)return;}
  if(parsed&&Number(parsed[1])!==Number(cur.barbearia_id))throw new Error('external_reference Mercado Pago diverge da assinatura vinculada');
  const targetPlan=cur.plano_pendente||cur.plano||(parsed?parsed[2]:null);if(!['starter','pro','premium'].includes(targetPlan))throw new Error('Plano alvo da assinatura inválido');
  const authorized=mp.status==='authorized';
  await pool.query(`UPDATE assinaturas SET plano=CASE WHEN $1 THEN $2 ELSE plano END,plano_pendente=CASE WHEN $3 IN ('authorized','canceled') THEN NULL ELSE plano_pendente END,status=$4,provedor='mercadopago',referencia_externa=$5,provedor_status=$3,checkout_url=COALESCE($6,checkout_url),proxima_cobranca=$7,billing_change_pending=false,billing_idempotency_key=NULL,atualizado_em=NOW() WHERE id=$8`,[authorized,targetPlan,mp.status,mpLocalStatus(mp.status,cur.status),String(id),mp.init_point||null,mp.next_payment_date?String(mp.next_payment_date).slice(0,10):null,cur.id]);
}
async function processMercado(payload){
  const {type,dataId}=payload||{};if(!dataId)return;
  if(type==='subscription_preapproval'){await syncPreapproval(dataId);return;}
  if(type==='subscription_authorized_payment'){
    const payment=await obterPagamentoAutorizado(dataId);if(payment?.preapproval_id)await syncPreapproval(payment.preapproval_id);
    const preId=payment?.preapproval_id||null,ar=preId?await pool.query(`SELECT id,barbearia_id,plano FROM assinaturas WHERE referencia_externa=$1 ORDER BY id DESC LIMIT 1`,[preId]):{rowCount:0,rows:[]};
    if(ar.rowCount){const a=ar.rows[0],value=Number(payment.transaction_amount??payment.amount??payment.transaction_details?.total_paid_amount??0),paidAt=payment.date_approved||payment.date_created||new Date().toISOString(),rawStatus=String(payment.status||'').toLowerCase(),status=rawStatus==='approved'?'pago':['pending','in_process','in_mediation'].includes(rawStatus)?'pendente':['rejected','cancelled','refunded','charged_back'].includes(rawStatus)?'cancelado':'pendente';if(!Number.isFinite(value)||value<=0||value>1000000)throw new Error('Valor de cobrança recorrente inválido');await pool.query(`INSERT INTO assinaturas_cobrancas(barbearia_id,assinatura_id,competencia,valor,status,vencimento,pago_em,provedor,referencia_externa) VALUES($1,$2,date_trunc('month',$3::timestamptz)::date,$4,$5,$3::timestamptz::date,CASE WHEN $5='pago' THEN $3::timestamptz ELSE NULL END,'mercadopago',$6) ON CONFLICT (provedor,referencia_externa) WHERE referencia_externa IS NOT NULL DO UPDATE SET valor=EXCLUDED.valor,status=EXCLUDED.status,pago_em=EXCLUDED.pago_em,atualizado_em=NOW()`,[a.barbearia_id,a.id,paidAt,value,status,String(payment.id||dataId)]);}
    return;
  }
  if(type==='payment'||type==='payments'){
    const tenantId=Number(payload?.barbeariaId||0);if(!Number.isSafeInteger(tenantId)||tenantId<1)throw new Error('Webhook de pagamento sem tenant válido');
    if(payload?.paymentScope==='subscription'){
      const payment=await obterPagamento(dataId);const db=await pool.connect();try{await db.query('BEGIN');await aplicarPagamentoPix(payment,{expectedTenantId:tenantId,db});await db.query('COMMIT');}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}return;
    }
    const seller=await getSellerAccessToken(tenantId),payment=await obterPagamento(dataId,seller);
    if(payload?.paymentScope==='store'){
      const m=String(payment.external_reference||'').match(/^barberflow-store:(\d+)$/);if(!m)throw new Error('Pagamento da loja sem referência BarberFlow válida');
      const oid=Number(m[1]);const rr=await pool.query(`SELECT id,barbearia_id FROM loja_pedidos WHERE id=$1 AND barbearia_id=$2`,[oid,tenantId]);if(!rr.rowCount)throw new Error('Pedido da loja não pertence ao tenant informado');await markOrderPayment(oid,payment);return;
    }
    const m=String(payment.external_reference||'').match(/^barberflow-booking:(\d+)$/);if(!m)throw new Error('Pagamento sem referência BarberFlow válida');
    const rid=Number(m[1]);const rr=await pool.query(`SELECT id,barbearia_id FROM reservas_pagamento WHERE id=$1 AND barbearia_id=$2`,[rid,tenantId]);if(!rr.rowCount)throw new Error('Reserva do pagamento não pertence ao tenant informado');
    const out=await finalizePaidReservation(rid,payment);if(out?.error&&!out.pending&&!out.conflict)throw new Error(out.error);return;
  }
}
async function processBilling(payload){
  const {barbearia_id,status,plano,referencia_externa,proxima_cobranca,provedor}=payload||{};const tenantId=Number(barbearia_id);if(!Number.isSafeInteger(tenantId)||tenantId<1||!['trial','ativa','inadimplente','atrasada','cancelada'].includes(status))throw new Error('Payload billing inválido');if(plano&&!['starter','pro','premium'].includes(plano))throw new Error('Plano billing inválido');const provider=provedor?String(provedor).trim().slice(0,40):null;if(provider&&!/^[a-z0-9_-]+$/i.test(provider))throw new Error('Provedor billing inválido');const target=await pool.query(`SELECT id FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false`,[tenantId]);if(!target.rowCount)throw new Error('Tenant billing inválido');const r=await pool.query(`UPDATE assinaturas SET status=$1,plano=COALESCE($2,plano),plano_pendente=NULL,referencia_externa=COALESCE($3,referencia_externa),proxima_cobranca=COALESCE($4,proxima_cobranca),provedor=COALESCE($5,provedor),atualizado_em=NOW() WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$6 ORDER BY id DESC LIMIT 1) RETURNING id`,[status,plano||null,referencia_externa?String(referencia_externa).slice(0,500):null,proxima_cobranca||null,provider,tenantId]);if(!r.rowCount)throw new Error('Assinatura não encontrada');
}
async function processWhatsapp(payload){const phoneId=String(payload?.phoneId||''),m=payload?.message;if(!phoneId||!m?.id)return;const integ=await integrationByPhoneId(phoneId);if(!integ)throw new Error('Phone Number ID não vinculado a nenhuma barbearia');if(m.type==='text')await processIncoming(integ,m.from,m.text?.body||'');}
async function processByProvider(provider,payload){if(provider==='mercadopago')return processMercado(payload);if(provider==='billing')return processBilling(payload);if(provider==='whatsapp')return processWhatsapp(payload);throw new Error(`Provider de webhook desconhecido: ${provider}`)}
module.exports={syncPreapproval,processMercado,processBilling,processWhatsapp,processByProvider};
