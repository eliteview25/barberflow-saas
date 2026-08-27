const crypto = require('crypto');
const {CATALOGO}=require('./planCatalog');

const BASE = 'https://api.mercadopago.com';

function tenantWebhookKey(){
  const root=String(process.env.MP_WEBHOOK_TENANT_SECRET||process.env.APP_SECRETS_ENCRYPTION_KEY||'');
  if(!root)return null;
  return crypto.createHmac('sha256',root).update('barberflow:mercadopago:tenant-routing:v1').digest();
}
function mpTenantSignature(barbeariaId){const key=tenantWebhookKey();if(!key)throw new Error('Segredo de roteamento do webhook Mercado Pago não configurado');return crypto.createHmac('sha256',key).update(String(barbeariaId)).digest('hex');}
function validarMpTenantSignature(barbeariaId,signature){const key=tenantWebhookKey();if(!key||!barbeariaId||!/^[a-fA-F0-9]{64}$/.test(String(signature||'')))return false;const expected=crypto.createHmac('sha256',key).update(String(barbeariaId)).digest();const got=Buffer.from(String(signature),'hex');return got.length===expected.length&&crypto.timingSafeEqual(got,expected);}

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado');
  return token;
}

async function mpFetch(path, options = {}) {
  const timeout=Math.max(1000,Math.min(30000,Number(process.env.EXTERNAL_HTTP_TIMEOUT_MS||10000)||10000));
  const resposta = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${options.accessToken || accessToken()}`,
      'Content-Type': 'application/json',
      ...(options.idempotencyKey ? {'X-Idempotency-Key': options.idempotencyKey} : {}),
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(timeout)
  });
  let data = {};
  try { data = await resposta.json(); } catch {}
  if (!resposta.ok) {
    const erro = new Error(data.message || data.error || `Mercado Pago respondeu ${resposta.status}`);
    erro.status = resposta.status;
    erro.data = data;
    erro.retryAfter = resposta.headers.get('retry-after');
    throw erro;
  }
  return data;
}

function precoPlano(plano) {
  const key=['starter','pro','premium'].includes(plano)?plano:'pro';
  const defaults={starter:CATALOGO.starter.preco_mensal,pro:CATALOGO.pro.preco_mensal,premium:CATALOGO.premium.preco_mensal};
  const envKey={starter:'PLAN_STARTER_PRICE',pro:'PLAN_PRO_PRICE',premium:'PLAN_PREMIUM_PRICE'}[key];
  const allowOverride=process.env.ALLOW_PLAN_PRICE_OVERRIDE==='true';
  const value=Number(allowOverride&&process.env[envKey]!=null?process.env[envKey]:defaults[key]);
  if(!Number.isFinite(value)||value<=0||value>100000)throw new Error(`Preço inválido para o plano ${key}`);
  return Math.round(value*100)/100;
}

function tituloPlano(plano) {
  return ({starter:'BarberFlow Starter', pro:'BarberFlow Pro', premium:'BarberFlow Premium'})[plano] || 'BarberFlow Pro';
}

async function criarAssinatura({ barbeariaId, plano, email, idempotencyKey, cardTokenId=null }) {
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
    status: cardTokenId ? 'authorized' : 'pending',
    ...(cardTokenId ? { card_token_id: cardTokenId } : {})
  };
  return mpFetch('/preapproval', { method: 'POST', body: JSON.stringify(body), idempotencyKey:idempotencyKey||`subscription-${barbeariaId}-${plano}` });
}

async function criarPreferenciaAgendamento({ reservaId, reservaToken, barbeariaId, slug, servicoId, servicoNome, valor, nome, email, accessToken, aceitarPix=true, aceitarCartao=true }) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  const retorno = `${appUrl}/agendar/${encodeURIComponent(slug)}?reserva=${encodeURIComponent(reservaToken||reservaId)}`;
  const body = {
    items: [{
      id: `servico-${servicoId}`,
      title: `${servicoNome} - agendamento`,
      description: 'Reserva de horário pelo BarberFlow',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Number(Number(valor).toFixed(2))
    }],
    external_reference: `barberflow-booking:${reservaId}`,
    back_urls: {
      success: `${retorno}&retorno=success`,
      pending: `${retorno}&retorno=pending`,
      failure: `${retorno}&retorno=failure`
    },
    auto_return: 'approved',
    notification_url: `${appUrl}/api/webhooks/mercadopago?barbearia_id=${encodeURIComponent(barbeariaId)}&tenant_sig=${encodeURIComponent(mpTenantSignature(barbeariaId))}`,
    payment_methods: {
      excluded_payment_types: [
        { id: 'ticket' },
        ...(!aceitarPix ? [{ id: 'bank_transfer' }] : []),
        ...(!aceitarCartao ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'prepaid_card' }] : [])
      ],
      installments: aceitarCartao ? 12 : 1
    }
  };
  const feePct=Number(process.env.MP_MARKETPLACE_FEE_PERCENT||0);
  if(!Number.isFinite(feePct)||feePct<0||feePct>30)throw new Error('MP_MARKETPLACE_FEE_PERCENT deve ficar entre 0 e 30');
  if(feePct>0) body.marketplace_fee=Number((Number(valor)*feePct/100).toFixed(2));
  if (nome || email) body.payer = { ...(nome ? { name: nome } : {}), ...(email ? { email } : {}) };
  return mpFetch('/checkout/preferences', { method: 'POST', body: JSON.stringify(body), accessToken });
}

async function obterAssinatura(id) {
  return mpFetch(`/preapproval/${encodeURIComponent(id)}`);
}

async function atualizarStatusAssinatura(id, status) { return mpFetch(`/preapproval/${encodeURIComponent(id)}`, {method:'PUT',body:JSON.stringify({status})}); }
async function atualizarValorAssinatura(id, valor) { return mpFetch(`/preapproval/${encodeURIComponent(id)}`, {method:'PUT',body:JSON.stringify({auto_recurring:{transaction_amount:Number(valor),currency_id:'BRL'}})}); }
async function atualizarPlanoAssinatura(id,{plano,barbeariaId}){return mpFetch(`/preapproval/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({reason:tituloPlano(plano),external_reference:`barberflow:${barbeariaId}:${plano}`,auto_recurring:{transaction_amount:precoPlano(plano),currency_id:'BRL'}})});}
async function criarPagamentoPixAssinatura({barbeariaId,plano,paymentRowId,email,identificationType='CPF',identificationNumber,idempotencyKey}){
  const appUrl=(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
  const digits=String(identificationNumber||'').replace(/\D/g,'');
  if(!/^\d{11,14}$/.test(digits))throw new Error('CPF/CNPJ inválido para o Pix');
  const external_reference=`barberflow-subscription-pix:${barbeariaId}:${plano}:${paymentRowId}`;
  const body={transaction_amount:precoPlano(plano),description:tituloPlano(plano),payment_method_id:'pix',external_reference,payer:{email,identification:{type:identificationType==='CNPJ'?'CNPJ':'CPF',number:digits}},notification_url:`${appUrl}/api/webhooks/mercadopago?scope=subscription&barbearia_id=${encodeURIComponent(barbeariaId)}&tenant_sig=${encodeURIComponent(mpTenantSignature(barbeariaId))}`,date_of_expiration:new Date(Date.now()+30*60*1000).toISOString()};
  return mpFetch('/v1/payments',{method:'POST',body:JSON.stringify(body),idempotencyKey});
}

async function obterPagamentoAutorizado(id) {
  return mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);
}

async function obterPagamento(id, accessToken) {
  return mpFetch(`/v1/payments/${encodeURIComponent(id)}`, { accessToken });
}

function validarWebhook({ xSignature, xRequestId, dataId, secret }) {
  if (!secret || !xSignature || !xRequestId || !dataId) return false;
  const parts={};
  for(const raw of String(xSignature).split(',')){
    const i=raw.indexOf('=');if(i<=0)continue;
    const k=raw.slice(0,i).trim(),v=raw.slice(i+1).trim();
    if(!k||!v||Object.prototype.hasOwnProperty.call(parts,k))return false;
    parts[k]=v;
  }
  if (!/^\d{9,16}$/.test(parts.ts||'') || !/^[a-fA-F0-9]{64}$/.test(parts.v1||'')) return false;
  const maxAge=Number(process.env.MP_WEBHOOK_MAX_AGE_SECONDS||0);
  if(Number.isFinite(maxAge)&&maxAge>0){
    let stamp=Number(parts.ts);if(stamp>1e12)stamp=Math.floor(stamp/1000);
    if(!Number.isFinite(stamp)||Math.abs(Math.floor(Date.now()/1000)-stamp)>Math.min(maxAge,86400*7))return false;
  }
  const manifest = `id:${String(dataId)};request-id:${String(xRequestId)};ts:${parts.ts};`;
  const calculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(calculado, 'hex');
  const b = Buffer.from(parts.v1.toLowerCase(), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  criarAssinatura,
  criarPreferenciaAgendamento,
  obterAssinatura,
  atualizarStatusAssinatura,
  atualizarValorAssinatura,
  atualizarPlanoAssinatura,
  criarPagamentoPixAssinatura,
  obterPagamentoAutorizado,
  obterPagamento,
  validarWebhook,
  precoPlano,
  mpTenantSignature,
  validarMpTenantSignature
};
