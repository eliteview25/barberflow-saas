const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Produtos aparece somente dentro da Loja no menu lateral',()=>{
  const common=read('frontend/js/common.js');
  assert.match(common,/\['loja-produtos',[^\n]+Produtos/);
  assert.doesNotMatch(common,/\['gestao-produtos'/);
  assert.match(common,/groupHtml\('gestao'[^\n]+gestao-pdv[^\n]+gestao-comissoes/);
  const gestaoGroup=common.match(/groupHtml\('gestao'[^\n]+/)[0];
  assert.doesNotMatch(gestaoGroup,/produtos|estoque/i);
});

test('Gestão normal não oferece aba Produtos e links antigos vão para Loja',()=>{
  const gestao=read('frontend/js/gestao.js');
  const normalTabs=gestao.match(/: \[\n([\s\S]*?)\n\];/)[1];
  assert.doesNotMatch(normalTabs,/Produtos|estoque/);
  assert.match(gestao,/requested==='estoque'&&!origemLoja/);
  assert.match(gestao,/location\.replace\('\/pages\/gestao\.html\?secao=estoque&origem=loja'\)/);
});

test('Produtos acessados pela Loja usam contexto visual da Loja',()=>{
  const gestao=read('frontend/js/gestao.js');
  assert.match(gestao,/document\.title='Produtos da Loja - BarberFlow'/);
  assert.match(gestao,/h1\.textContent='Produtos da loja'/);
  assert.match(gestao,/tabsEl\.classList\.add\('hidden'\)/);
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
