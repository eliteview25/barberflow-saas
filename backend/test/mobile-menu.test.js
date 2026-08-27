const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const common=fs.readFileSync(path.resolve(__dirname,'../../frontend/js/common.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../../frontend/style.css'),'utf8');

test('painel não renderiza navegação inferior no mobile',()=>{
  assert.ok(!common.includes('<nav class="mobile-bottom-nav"'),'menu inferior comum não deve existir');
  assert.ok(!common.includes('mobile-bottom-nav master-bottom'),'menu inferior do master não deve existir');
  assert.match(css,/\.mobile-bottom-nav\{display:none!important\}/);
});

test('menu lateral mobile tem lista rolável e logout persistente',()=>{
  assert.match(css,/\.menu\{display:flex;flex:1 1 auto;min-height:0;flex-direction:column;overflow-x:hidden;overflow-y:auto/);
  assert.match(css,/\.sidebar-bottom\{display:block;flex:0 0 auto;margin-top:8px/);
  assert.match(css,/height:100dvh/);
});

test('mobile não reserva espaço para barra inferior removida',()=>{
  assert.match(css,/body\{padding-top:62px;padding-bottom:0;background:#f5f6f8\}/);
  assert.match(css,/padding-bottom:env\(safe-area-inset-bottom\)/);
});
