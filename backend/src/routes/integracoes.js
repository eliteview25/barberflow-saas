const express = require('express');
const pool = require('../config/db');
const { obterAssinatura, obterPagamentoAutorizado, validarWebhook } = require('../services/mercadoPago');
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
    SET plano=$1,
        status=COALESCE($2,status),
        provedor='mercadopago',
        referencia_externa=$3,
        provedor_status=$4,
        checkout_url=COALESCE($5,checkout_url),
        proxima_cobranca=$6,
        atualizado_em=NOW()
    WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$7 ORDER BY id DESC LIMIT 1)
  `,[plano,local,id,assinaturaMp.status,assinaturaMp.init_point||null,assinaturaMp.next_payment_date?String(assinaturaMp.next_payment_date).slice(0,10):null,barbeariaId]);
}

router.post('/mercadopago', async (req,res) => {
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  const secret = process.env.MP_WEBHOOK_SECRET || '';
  const ok = validarWebhook({
    xSignature: req.headers['x-signature'],
    xRequestId: req.headers['x-request-id'],
    dataId,
    secret
  });
  if (secret && !ok) return res.status(401).json({erro:'Assinatura do webhook inválida'});

  res.sendStatus(200);

  try {
    const type = req.query.type || req.body?.type;
    if (type === 'subscription_preapproval' && dataId) {
      await sincronizarPreapproval(dataId);
      return;
    }
    if (type === 'subscription_authorized_payment' && dataId) {
      const pagamento = await obterPagamentoAutorizado(dataId);
      if (pagamento?.preapproval_id) await sincronizarPreapproval(pagamento.preapproval_id);
    }
  } catch (e) {
    console.error('Erro processando webhook Mercado Pago:', e.message);
  }
});

// Mantido para integrações internas/manuais em ambiente controlado.
router.post('/billing', async (req,res) => {
  if(!process.env.BILLING_WEBHOOK_SECRET || req.headers['x-barberflow-secret']!==process.env.BILLING_WEBHOOK_SECRET) return res.status(401).json({erro:'Webhook não autorizado'});
  const {barbearia_id,status,plano,referencia_externa,proxima_cobranca,provedor}=req.body;
  if(!barbearia_id||!['trial','ativa','inadimplente','cancelada'].includes(status))return res.status(400).json({erro:'Payload inválido'});
  const r=await pool.query(`UPDATE assinaturas SET status=$1,plano=COALESCE($2,plano),referencia_externa=COALESCE($3,referencia_externa),proxima_cobranca=COALESCE($4,proxima_cobranca),provedor=COALESCE($5,provedor),atualizado_em=NOW() WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$6 ORDER BY id DESC LIMIT 1) RETURNING *`,[status,plano||null,referencia_externa||null,proxima_cobranca||null,provedor||null,barbearia_id]);
  if(!r.rowCount)return res.status(404).json({erro:'Assinatura não encontrada'});res.json(r.rows[0]);
});

module.exports=router;
