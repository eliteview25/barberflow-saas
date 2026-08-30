const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const common=fs.readFileSync(path.resolve(__dirname,'../../frontend/js/common.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../../frontend/style.css'),'utf8');

test('painel mobile usa navegação inferior compacta igual ao mockup',()=>{
  assert.match(common,/<nav class="mobile-bottom-nav"/);
  assert.match(common,/<span>Mais<\/span>/);
  assert.match(css,/grid-template-columns:repeat\(5,1fr\)/);
});

test('menu lateral mobile continua rolável e preserva logout',()=>{
  assert.match(css,/overflow-y:auto/);assert.match(css,/sidebar-bottom/);assert.match(css,/height:100dvh/);
});

test('mobile reserva safe area para navegação inferior fixa',()=>{
  assert.match(css,/padding-bottom:76px!important/);assert.match(css,/position:fixed!important/);assert.match(css,/env\(safe-area-inset-bottom\)/);
});

test('hotfix 3.2.1 mantém botão do menu escuro e checkbox de senha compacto',()=>{
  assert.match(css,/\.show-password-check input\[type="checkbox"\],[\s\S]*?width:18px!important/);
  assert.match(css,/\.mobile-appbar \.icon-btn,[\s\S]*?background:transparent!important/);
  assert.match(css,/\.mobile-appbar \.icon-btn,[\s\S]*?color:#fff!important/);
});
