const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const front=path.resolve(root,'../frontend');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Supermaster valida ambiente do Access Token e Public Key do Mercado Pago',()=>{const s=read('src/services/platformPaymentGateways.js');assert.match(s,/mercadoPagoCredentialEnvironment/);assert.match(s,/ambientes diferentes/);assert.match(s,/APP_USR/);assert.match(s,/TEST-/)});
test('diagnóstico consulta meios de pagamento e detecta Pix/cartão',()=>{const s=read('src/services/platformPaymentGateways.js');assert.match(s,/\/v1\/payment_methods/);assert.match(s,/pix_available/);assert.match(s,/credit_card_available/);assert.match(s,/payment_type_id===['"]credit_card['"]/)});
test('checkout Pix bloqueia com orientação quando conta não oferece Pix',()=>{const t=read('src/routes/tenant.js'),f=fs.readFileSync(path.join(front,'js/assinatura.js'),'utf8');assert.match(t,/Pix não está habilitado na conta Mercado Pago/);assert.match(f,/Cadastre\/ative uma chave Pix/)});
test('cartão possui fallback para assinatura pendente no checkout oficial',()=>{const t=read('src/routes/tenant.js'),f=fs.readFileSync(path.join(front,'js/assinatura.js'),'utf8');assert.match(t,/subscription-card-fallback/);assert.match(t,/requires_external_checkout:true/);assert.match(t,/checkout_url:fallback\.init_point/);assert.match(f,/r\.requires_external_checkout&&r\.checkout_url/)});
test('erros Mercado Pago ficam legíveis sem expor credenciais',()=>{const t=read('src/routes/tenant.js');assert.match(t,/safeMpErrorDetail/);assert.match(t,/\[credencial\]/);assert.match(t,/Não foi possível gerar o Pix da assinatura\$\{detalhe/)});
test('diagnóstico identifica conta Mercado Pago Brasil para BRL e Pix',()=>{const p=read('src/services/platformPaymentGateways.js'),t=read('src/routes/tenant.js');assert.match(p,/site_id/);assert.match(p,/MLB/);assert.match(t,/conta Mercado Pago Brasil/)});
