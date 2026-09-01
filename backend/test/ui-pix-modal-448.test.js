const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'frontend/style.css'),'utf8');

test('Pix manual mobile usa card compacto e centralizado',()=>{
  assert.match(css,/4\.4\.8 — confirmação de Pix compacta/);
  assert.match(css,/#dashboardPixModal,\s*#pixManualConfirmModal\{[\s\S]*?align-items:center!important;[\s\S]*?justify-content:center!important;/);
  assert.match(css,/width:min\(92vw,420px\)!important;/);
  assert.match(css,/max-height:min\(82dvh,620px\)!important;/);
  assert.match(css,/border-radius:16px!important;/);
});

test('alteração 4.4.8 é visual e mantém endpoint one-click sem step-up',()=>{
  const tenant=fs.readFileSync(path.join(root,'backend/src/routes/tenant.js'),'utf8');
  const routeLine=tenant.split(/\r?\n/).find(line=>line.includes("router.post('/pagamentos-pendentes/:id/confirmar'"));
  assert.ok(routeLine,'rota de confirmação Pix deve existir');
  assert.doesNotMatch(routeLine,/exigirStepUp/);
});

test('páginas carregam CSS v448',()=>{
  for(const f of ['frontend/index.html','frontend/pages/pagamentos.html']){
    const html=fs.readFileSync(path.join(root,f),'utf8');
    assert.match(html,/style\.css\?v=20260901-v448/);
  }
});
