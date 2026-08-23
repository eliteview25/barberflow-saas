const crypto = require('crypto');

const BASE = 'https://api.mercadopago.com';

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado');
  return token;
}

async function mpFetch(path, options = {}) {
  const resposta = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data = {};
  try { data = await resposta.json(); } catch {}
  if (!resposta.ok) {
    const erro = new Error(data.message || data.error || `Mercado Pago respondeu ${resposta.status}`);
    erro.status = resposta.status;
    erro.data = data;
    throw erro;
  }
  return data;
}

function precoPlano(plano) {
  const valores = {
    starter: Number(process.env.PLAN_STARTER_PRICE || 39.90),
    pro: Number(process.env.PLAN_PRO_PRICE || 69.90),
    premium: Number(process.env.PLAN_PREMIUM_PRICE || 119.90)
  };
  return valores[plano] || valores.pro;
}

function tituloPlano(plano) {
  return ({starter:'BarberFlow Starter', pro:'BarberFlow Pro', premium:'BarberFlow Premium'})[plano] || 'BarberFlow Pro';
}

async function criarAssinatura({ barbeariaId, plano, email }) {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const body = {
    reason: tituloPlano(plano),
    external_reference: `barberflow:${barbeariaId}:${plano}`,
    payer_email: email,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: precoPlano(plano),
      currency_id: 'BRL'
    },
    back_url: `${appUrl}/pages/assinatura.html?retorno=mercadopago`,
    status: 'pending'
  };
  return mpFetch('/preapproval', { method: 'POST', body: JSON.stringify(body) });
}

async function obterAssinatura(id) {
  return mpFetch(`/preapproval/${encodeURIComponent(id)}`);
}

async function atualizarStatusAssinatura(id, status) {
  return mpFetch(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

async function obterPagamentoAutorizado(id) {
  return mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);
}

function validarWebhook({ xSignature, xRequestId, dataId, secret }) {
  if (!secret) return true;
  if (!xSignature || !xRequestId || !dataId) return false;
  const partes = Object.fromEntries(String(xSignature).split(',').map(p => p.split('=').map(s => s.trim())));
  if (!partes.ts || !partes.v1) return false;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${partes.ts};`;
  const calculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(calculado, 'hex');
  const b = Buffer.from(partes.v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  criarAssinatura,
  obterAssinatura,
  atualizarStatusAssinatura,
  obterPagamentoAutorizado,
  validarWebhook,
  precoPlano
};
