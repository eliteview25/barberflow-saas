const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
process.env.MP_WEBHOOK_TENANT_SECRET='mp-tenant-test-secret-with-enough-entropy-123456789';
const {validarWebhook,mpTenantSignature,validarMpTenantSignature,precoPlano}=require('../src/services/mercadoPago');

test('assinatura de webhook Mercado Pago segue manifesto id/request-id/ts',()=>{
  const secret='webhook-secret-test',dataId='123456',requestId='request-abc',ts=String(Math.floor(Date.now()/1000));
  const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
  assert.equal(validarWebhook({xSignature:`ts=${ts},v1=${v1}`,xRequestId:requestId,dataId,secret}),true);
  assert.equal(validarWebhook({xSignature:`ts=${ts},v1=${'0'.repeat(64)}`,xRequestId:requestId,dataId,secret}),false);
});

test('roteamento tenant Mercado Pago usa HMAC e rejeita tenant diferente',()=>{
  const sig=mpTenantSignature(42);assert.equal(validarMpTenantSignature(42,sig),true);assert.equal(validarMpTenantSignature(43,sig),false);
});

test('preço de plano é finito e positivo',()=>{assert.ok(precoPlano('starter')>0);assert.ok(precoPlano('premium')>precoPlano('starter'))});
