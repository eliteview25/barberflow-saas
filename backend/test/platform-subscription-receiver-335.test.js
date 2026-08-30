const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('assinaturas SaaS usam credenciais centrais do Supermaster',()=>{const t=read('src/routes/tenant.js'),mp=read('src/services/mercadoPago.js'),pg=read('src/services/platformPaymentGateways.js');assert.match(t,/getPlatformMercadoPagoCredentials/);assert.match(t,/recebedor:'supermaster'/);assert.match(mp,/getPlatformMercadoPagoCredentials/);assert.match(pg,/subscription_receiver/);});
test('produção não cai silenciosamente para conta Mercado Pago do ambiente',()=>{const pg=read('src/services/platformPaymentGateways.js'),app=read('src/app.js');assert.match(pg,/ALLOW_LEGACY_PLATFORM_MP_ENV/);assert.match(pg,/process\.env\.NODE_ENV!==['"]production['"]/);assert.doesNotMatch(app,/required=\[[^\]]*MP_WEBHOOK_SECRET/);});
test('webhook de assinatura usa segredo central salvo pelo Supermaster',()=>{const r=read('src/routes/integracoes.js'),pg=read('src/services/platformPaymentGateways.js');assert.match(r,/platformWebhookSecret/);assert.match(r,/paymentScope==='subscription'/);assert.match(pg,/async function platformWebhookSecret/);});
test('troca de conta recebedora é bloqueada com recorrências ativas',()=>{const pg=read('src/services/platformPaymentGateways.js');assert.match(pg,/currentAccount&&nextAccount&&currentAccount!==nextAccount/);assert.match(pg,/assinatura\(s\) recorrente\(s\) ativa\(s\)/);assert.match(pg,/Não é possível remover a conta recebedora/);});
test('gateway da barbearia continua separado da cobrança SaaS',()=>{const owner=read('src/services/paymentGateways.js'),platform=read('src/services/platformPaymentGateways.js');assert.match(owner,/source:'owner_credentials'/);assert.match(platform,/source:'supermaster'/);});
