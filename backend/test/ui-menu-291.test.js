const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Produtos e estoque aparecem como módulo próprio, sem Loja no menu',()=>{
  const common=read('frontend/js/common.js');
  assert.match(common,/\['gestao-produtos',[^\n]+Produtos & Estoque/);
  assert.doesNotMatch(common,/lojaGroupHtml|loja-config|loja-pedidos/);
  assert.match(common,/groupHtml\('vendas'[^\n]+gestao-pdv[^\n]+gestao-vendas/);
});

test('Gestão oferece PDV, histórico e Produtos & Estoque como áreas reais',()=>{
  const gestao=read('frontend/js/gestao.js');
  assert.match(gestao,/\['pdv','🧾 Caixa\/PDV'\]/);
  assert.match(gestao,/\['vendas','📋 Histórico'\]/);
  assert.match(gestao,/\['estoque','📦 Produtos & Estoque'\]/);
  assert.match(gestao,/async function vendas\(\)/);
  assert.match(gestao,/api\('\/operacao\/vendas'\)/);
});

test('Produtos usam contexto operacional e não exibem publicação em loja',()=>{
  const gestao=read('frontend/js/gestao.js');
  assert.match(gestao,/document.title='Produtos & Estoque - BarberFlow'/);
  assert.match(gestao,/h1\.textContent='Produtos & Estoque'/);
  assert.doesNotMatch(gestao,/Mostrar na loja|produtoMostrarLoja|origemLoja/);
});

test('hover do menu lateral usa fonte preta e fundo claro',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/\.sidebar \.menu a:hover[\s\S]*?background:#f3f4f6!important;color:#111827!important/);
  assert.match(css,/\.sidebar \.menu-group-toggle:hover[\s\S]*?color:#111827!important/);
});

test('menu lateral aceita rolagem por wheel trackpad e toque',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/\.sidebar \.menu\{[^}]*flex:1 1 auto[^}]*overflow-y:auto[^}]*overflow-x:hidden/);
  assert.match(css,/overscroll-behavior:contain/);
  assert.match(css,/scrollbar-width:thin/);
});
