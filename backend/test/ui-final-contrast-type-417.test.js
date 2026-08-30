const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const css=fs.readFileSync(path.join(root,'frontend','style.css'),'utf8');

test('autenticação mantém campos, MFA, consentimento e autofill no tema escuro',()=>{
  assert.match(css,/\.auth-body \.login-mfa-box,[\s\S]*?background:linear-gradient\(145deg,#12161b,#0c0f13\)!important/);
  assert.match(css,/\.auth-body \.legal-consent[\s\S]*?border:1px solid #2c3239/);
  assert.match(css,/\.auth-body input:-webkit-autofill,[\s\S]*?-webkit-box-shadow:0 0 0 1000px #0b0e12 inset!important/);
  assert.match(css,/\.auth-body \.notice\.error\{[\s\S]*?background:rgba\(239,68,68,\.08\)!important/);
});

test('superfícies auxiliares antigas são convertidas para carvão',()=>{
  for(const selector of ['.security-card','.security-challenge-head','.ai-quota','.onboarding-step','.support-ticket','.gateway-modal-card','.store-admin-product']){
    const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(css,new RegExp('body:not\\(\\.public-bg\\):not\\(\\.auth-body\\) '+escaped+'[\\s\\S]*?background:#111419!important'));
  }
});

test('tipografia desktop possui escala confortável nas áreas principais',()=>{
  assert.match(css,/@media\(min-width:761px\)[\s\S]*?\.topbar h1,[\s\S]*?font-size:27px!important/);
  assert.match(css,/\.premium-kpi \.kpi-top\{font-size:12\.5px!important/);
  assert.match(css,/\.agenda-table td\{font-size:12\.5px!important/);
  assert.match(css,/\.clients-table td,[\s\S]*?font-size:12px!important/);
  assert.match(css,/\.plan-card p\{font-size:12px!important/);
  assert.match(css,/\.master-table td\{font-size:12px!important/);
});

test('tipografia mobile amplia informações e evita zoom nos campos',()=>{
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.auth-card input,[\s\S]*?font-size:16px!important/);
  assert.match(css,/\.mobile-operation-alert span\{font-size:9\.5px!important/);
  assert.match(css,/\.mobile-status-item strong\{font-size:15px!important/);
  assert.match(css,/\.mobile-upcoming-copy strong\{font-size:10\.5px!important/);
  assert.match(css,/\.public-booking-card input,[\s\S]*?font-size:16px!important/);
});

test('áreas de QR Code continuam brancas para preservar a leitura',()=>{
  assert.match(css,/\.qr-provider-visual img,[\s\S]*?\.pix-qr-wrap\{background:#fff!important/);
});
