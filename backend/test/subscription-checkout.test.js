const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const front=path.resolve(root,'../frontend');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('CTA de planos tenta migrar assinatura recorrente e abre checkout quando necessário',()=>{const s=fs.readFileSync(path.join(front,'js/assinatura.js'),'utf8');assert.match(s,/\/assinatura\/migrar/);assert.match(s,/requires_checkout/);assert.match(s,/openCheckout/)});
test('checkout de assinatura oferece cartão e Pix dentro do BarberFlow',()=>{const h=fs.readFileSync(path.join(front,'pages/assinatura.html'),'utf8');assert.match(h,/id="payMethodCard"/);assert.match(h,/id="payMethodPix"/);assert.match(h,/cardPaymentBrick_container/);assert.match(h,/pixQrImage/);assert.match(h,/pixCopyCode/);assert.match(h,/sdk\.mercadopago\.com\/js\/v2/)});
test('cartão é tokenizado no frontend e backend recebe somente token',()=>{const f=fs.readFileSync(path.join(front,'js/assinatura.js'),'utf8');const t=read('src/routes/tenant.js');assert.match(f,/token:formData\.token/);assert.match(t,/checkout\/cartao/);assert.match(t,/req\.body\?\.token/);assert.doesNotMatch(t,/card_number|security_code|cvv/i)});
test('Pix da assinatura retorna QR base64 e copia e cola',()=>{const t=read('src/routes/tenant.js');const mp=read('src/services/mercadoPago.js');assert.match(t,/qr_code_base64/);assert.match(t,/qr_code:/);assert.match(mp,/payment_method_id:'pix'/);assert.match(mp,/date_of_expiration/)});
test('Pix SaaS é isolado por tenant e valida valor antes de ativar',()=>{const s=read('src/services/subscriptionPayments.js');assert.match(s,/expectedTenantId/);assert.match(s,/barberflow-subscription-pix/);assert.match(s,/Math\.abs\(amount-Number\(row\.valor\)\)>0\.01/);assert.match(s,/WHERE id=\$1 AND barbearia_id=\$2 FOR UPDATE/)});
test('migração recorrente atualiza preapproval existente em vez de criar segunda assinatura',()=>{const t=read('src/routes/tenant.js');const mp=read('src/services/mercadoPago.js');assert.match(t,/active|status==='ativa'/i);assert.match(t,/atualizarPlanoAssinatura/);assert.match(mp,/PUT/);assert.match(mp,/auto_recurring:\{transaction_amount:precoPlano\(plano\),currency_id:'BRL'\}/)});
test('downgrade respeita limite de profissionais no servidor',()=>{const t=read('src/routes/tenant.js');assert.match(t,/validarLimitePlano/);assert.match(t,/COUNT\(\*\)::int n FROM barbeiros WHERE barbearia_id=\$1 AND ativo=true/);assert.match(t,/LIMITE_PROFISSIONAIS/)});
test('Pix pré-pago vencido não continua ativo indefinidamente',()=>{const s=read('src/services/planos.js');assert.match(s,/pixPrePagoExpirado/);assert.match(s,/a\.provedor!==['"]mercadopago_pix['"]/);assert.match(s,/proxima_cobranca/);assert.match(s,/ctx\.ativa/)});
test('Pix pendente válido é reutilizado e não cria cobrança paralela',()=>{const t=read('src/routes/tenant.js');assert.match(t,/status IN \('criando','pendente'\) AND expira_em>NOW\(\)/);assert.match(t,/reutilizado:true/);assert.match(t,/qr_code_base64/)});
test('Pix cancelado limpa mudança de plano pendente',()=>{const s=read('src/services/subscriptionPayments.js');assert.match(s,/if\(status==='cancelado'\)/);assert.match(s,/plano_pendente=NULL,billing_change_pending=false/)});
