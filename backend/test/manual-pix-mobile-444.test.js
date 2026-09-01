const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('frontend/style.css');
const dash=read('frontend/index.html');
const payHtml=read('frontend/pages/pagamentos.html');
const payJs=read('frontend/js/pagamentos.js');

test('4.4.4 mantém ação de confirmação Pix visível no mobile',()=>{
  assert.match(css,/#dashboardPixModal \.dashboard-pix-modal-actions,[\s\S]*position:sticky!important;bottom:0!important/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/max-height:calc\(100dvh - max\(8px,env\(safe-area-inset-top\)\)\)/);
  assert.match(css,/#dashboardPixModal \.dashboard-pix-modal-box,[\s\S]*overflow:auto!important/);
});

test('lista de pendências vira card com botão de largura total no mobile',()=>{
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.pending-payment-row\{display:grid!important/);
  assert.match(css,/\.pending-payment-confirm\{width:100%!important;min-height:48px!important/);
  assert.match(css,/\.dashboard-pix-confirm-btn\{grid-column:1!important;grid-row:auto!important;width:100%!important/);
});

test('página Pagamentos usa modal próprio em vez de confirm nativo para Pix',()=>{
  for(const id of ['pixManualConfirmModal','pixManualConfirmDetails','pixManualConfirmButton','pixManualConfirmCancel']) assert.match(payHtml,new RegExp(`id="${id}"`));
  assert.match(payJs,/openPixConfirmModal/);
  assert.match(payJs,/confirmPendingPix/);
  assert.doesNotMatch(payJs,/confirm\('Você conferiu o recebimento deste Pix\?'\)/);
});

test('modal da página Pagamentos reporta resultado do envio WhatsApp',()=>{
  assert.match(payJs,/whatsapp_enviado===true/);
  assert.match(payJs,/whatsapp_enviado===false/);
  assert.match(payJs,/WhatsApp não conectado/);
  assert.match(dash,/dashboardPixModalConfirm/);
});
