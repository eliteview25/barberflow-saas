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


test('menu lateral usa links nativos sem data-click',()=>{
  const common=fs.readFileSync(path.join(__dirname,'../../frontend/js/common.js'),'utf8');
  assert.match(common,/const menu=allowed\.map\(x=>`<a class=/);
  const line=common.split('\n').find(x=>x.includes('const menu=allowed.map'))||'';
  assert.ok(!line.includes('data-click='),'links de navegação não podem depender do dispatcher data-click');
  assert.match(common,/closest\('\.sidebar \.menu a\[href\]'\)/);
});

test('assets do painel têm versão para quebrar cache antigo',()=>{
  const pages=['index.html','pages/barbeiros.html','pages/configuracoes.html','pages/financeiro.html','pages/automacoes.html'];
  for(const rel of pages){
    const html=fs.readFileSync(path.join(__dirname,'../../frontend',rel),'utf8');
    assert.match(html,/common\.js\?v=20260826-sidebar3/);
    assert.match(html,/style\.css\?v=20260826-sidebar3/);
  }
});
