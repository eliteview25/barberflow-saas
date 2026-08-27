const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const common=fs.readFileSync(path.resolve(__dirname,'../../frontend/js/common.js'),'utf8');

test('links reais do menu não têm navegação cancelada pelo data-click',()=>{
  assert.match(common,/const navigates=el\.tagName==='A'&&href&&href!=='#'/);
  assert.match(common,/if\(!navigates\)e\.preventDefault\(\)/);
});

test('menu principal continua usando href reais para páginas',()=>{
  for(const href of ['/pages/barbeiros.html','/pages/financeiro.html','/pages/automacoes.html','/pages/configuracoes.html']){
    assert.ok(common.includes(href),`href ausente: ${href}`);
  }
});
