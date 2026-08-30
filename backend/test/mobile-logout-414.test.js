const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const css=fs.readFileSync(path.join(root,'frontend','style.css'),'utf8');
const common=fs.readFileSync(path.join(root,'frontend','js','common.js'),'utf8');

test('drawer mobile fica acima da navegação inferior',()=>{
  assert.match(css,/body\.menu-open \.sidebar\{z-index:2100!important\}/);
  assert.match(css,/body\.menu-open \.sidebar-backdrop\{z-index:2050!important\}/);
  assert.match(css,/body\.menu-open \.mobile-bottom-nav\{z-index:1800!important\}/);
});

test('logout permanece visível e fora da área rolável do menu',()=>{
  assert.match(common,/<div class="sidebar-bottom">[\s\S]*?data-click="logout\(\)"[\s\S]*?>Sair</);
  assert.match(css,/\.sidebar \.sidebar-bottom\{[\s\S]*?flex:0 0 auto!important/);
  assert.match(css,/\.sidebar \.sidebar-bottom>a\[data-click\*="logout"\]\{[\s\S]*?display:flex!important[\s\S]*?visibility:visible!important/);
});
