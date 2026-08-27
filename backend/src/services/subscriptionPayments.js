const crypto=require('crypto');
const pool=require('../config/db');
const {precoPlano,obterPagamento}=require('./mercadoPago');

async function ensureSubscriptionPaymentSchema(db=pool){
  await db.query(`CREATE TABLE IF NOT EXISTS assinaturas_pagamentos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    assinatura_id INTEGER REFERENCES assinaturas(id) ON DELETE SET NULL,
    plano VARCHAR(30) NOT NULL CHECK(plano IN ('starter','pro','premium')),
    valor NUMERIC(10,2) NOT NULL CHECK(valor>0),
    forma_pagamento VARCHAR(20) NOT NULL CHECK(forma_pagamento IN ('pix','cartao')),
    status VARCHAR(30) NOT NULL DEFAULT 'criando',
    referencia_externa TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    expira_em TIMESTAMP,
    pago_em TIMESTAMP,
    qr_code TEXT,
    qr_code_base64 TEXT,
    ticket_url TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  for(const [col,type] of [['qr_code','TEXT'],['qr_code_base64','TEXT'],['ticket_url','TEXT']]) await db.query(`ALTER TABLE assinaturas_pagamentos ADD COLUMN IF NOT EXISTS ${col} ${type}`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_assinaturas_pagamentos_ref ON assinaturas_pagamentos(referencia_externa) WHERE referencia_externa IS NOT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_assinaturas_pagamentos_tenant_status ON assinaturas_pagamentos(barbearia_id,status,criado_em DESC)`);
}
function pixExternalReference({barbeariaId,plano,paymentRowId}){return `barberflow-subscription-pix:${barbeariaId}:${plano}:${paymentRowId}`}
function parsePixExternalReference(value){const m=String(value||'').match(/^barberflow-subscription-pix:(\d+):(starter|pro|premium):(\d+)$/);return m?{barbeariaId:Number(m[1]),plano:m[2],paymentRowId:Number(m[3])}:null}
function normalizeMpPaymentStatus(status){const s=String(status||'').toLowerCase();if(s==='approved')return 'pago';if(['pending','in_process','in_mediation','authorized'].includes(s))return 'pendente';if(['rejected','cancelled','canceled','refunded','charged_back'].includes(s))return 'cancelado';return 'pendente'}
function paymentAmount(payment){return Number(payment?.transaction_amount??payment?.amount??payment?.transaction_details?.total_paid_amount??0)}
async function aplicarPagamentoPix(payment,{expectedTenantId=null,db=pool}={}){
  await ensureSubscriptionPaymentSchema(db);
  const parsed=parsePixExternalReference(payment?.external_reference);if(!parsed)throw new Error('Pagamento Pix sem referência de assinatura válida');
  if(expectedTenantId&&Number(expectedTenantId)!==parsed.barbeariaId)throw new Error('Pagamento Pix pertence a outro tenant');
  const row=(await db.query(`SELECT * FROM assinaturas_pagamentos WHERE id=$1 AND barbearia_id=$2 FOR UPDATE`,[parsed.paymentRowId,parsed.barbeariaId])).rows[0];
  if(!row||row.plano!==parsed.plano)throw new Error('Pagamento de assinatura não encontrado');
  const amount=paymentAmount(payment);if(!Number.isFinite(amount)||Math.abs(amount-Number(row.valor))>0.01)throw new Error('Valor do pagamento Pix diverge do esperado');
  const status=normalizeMpPaymentStatus(payment.status),ref=String(payment.id||row.referencia_externa||'');
  await db.query(`UPDATE assinaturas_pagamentos SET status=$1,referencia_externa=COALESCE(NULLIF($2,''),referencia_externa),pago_em=CASE WHEN $1='pago' THEN COALESCE(pago_em,NOW()) ELSE pago_em END,atualizado_em=NOW() WHERE id=$3`,[status,ref,row.id]);
  if(status==='cancelado'){
    await db.query(`UPDATE assinaturas SET plano_pendente=NULL,billing_change_pending=false,billing_idempotency_key=NULL,atualizado_em=NOW() WHERE barbearia_id=$1 AND plano_pendente=$2 AND COALESCE(billing_change_pending,false)=true`,[parsed.barbeariaId,parsed.plano]);
  }
  if(status==='pago'){
    const atual=(await db.query(`SELECT id,plano,proxima_cobranca FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1 FOR UPDATE`,[parsed.barbeariaId])).rows[0];
    if(!atual)throw new Error('Assinatura local não encontrada');
    const renewing=atual.plano===parsed.plano;
    await db.query(`UPDATE assinaturas SET plano=$1,plano_pendente=NULL,status='ativa',provedor='mercadopago_pix',provedor_status='approved',checkout_url=NULL,billing_change_pending=false,billing_idempotency_key=NULL,proxima_cobranca=CASE WHEN $2 AND proxima_cobranca>=CURRENT_DATE THEN (proxima_cobranca+INTERVAL '1 month')::date ELSE (CURRENT_DATE+INTERVAL '1 month')::date END,atualizado_em=NOW() WHERE id=$3`,[parsed.plano,renewing,atual.id]);
    await db.query(`INSERT INTO assinaturas_cobrancas(barbearia_id,assinatura_id,competencia,valor,status,vencimento,pago_em,provedor,referencia_externa) VALUES($1,$2,date_trunc('month',CURRENT_DATE)::date,$3,'pago',CURRENT_DATE,NOW(),'mercadopago_pix',$4) ON CONFLICT (provedor,referencia_externa) WHERE referencia_externa IS NOT NULL DO UPDATE SET status='pago',pago_em=COALESCE(assinaturas_cobrancas.pago_em,NOW()),valor=EXCLUDED.valor,atualizado_em=NOW()`,[parsed.barbeariaId,atual.id,Number(row.valor),ref]);
  }
  return {...row,status,referencia_externa:ref};
}
async function sincronizarPagamentoPixById(paymentId,tenantId){const payment=await obterPagamento(paymentId);return pool.connect().then(async db=>{try{await db.query('BEGIN');const out=await aplicarPagamentoPix(payment,{expectedTenantId:tenantId,db});await db.query('COMMIT');return {payment,out};}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}})}
function newIdempotencyKey(prefix='subscription'){return `${prefix}-${crypto.randomUUID()}`}
module.exports={ensureSubscriptionPaymentSchema,pixExternalReference,parsePixExternalReference,normalizeMpPaymentStatus,aplicarPagamentoPix,sincronizarPagamentoPixById,newIdempotencyKey,precoPlano};
