const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../../frontend/style.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../../frontend/pages/pagamentos.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../../frontend/js/pagamentos.js'),'utf8');

test('modal de credenciais possui estrutura centralizada no desktop',()=>{
  assert.match(css,/\.modal-backdrop\s*\{[^}]*position:fixed;[^}]*display:flex;[^}]*align-items:center;[^}]*justify-content:center;/s);
  assert.match(css,/\.gateway-modal-card\s*\{[^}]*width:min\(620px,calc\(100vw - 48px\)\);[^}]*max-height:calc\(100dvh - 48px\);/s);
  assert.match(css,/\.gateway-modal-card form\s*\{[^}]*overflow-y:auto;/s);
});

test('modal de credenciais vira bottom sheet otimizado no mobile',()=>{
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.modal-backdrop\s*\{[^}]*align-items:flex-end;/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.gateway-modal-card\s*\{[^}]*width:100%;[^}]*max-height:92dvh;/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.gateway-modal-card \.actions\s*\{[^}]*grid-template-columns:1fr 1fr;/);
  assert.match(css,/\.gateway-modal-card \.field input,\.gateway-modal-card \.field select\s*\{[\s\S]*?font-size:16px;/);
});

test('pagina usa assets novos e modal tem fechamento por Escape',()=>{
  assert.match(html,/style\.css\?v=[A-Za-z0-9._-]+/);
  assert.match(html,/pagamentos\.js\?v=[A-Za-z0-9._-]+/);
  assert.match(js,/e\.key==='Escape'/);
  assert.match(js,/lastGatewayTrigger/);
});
