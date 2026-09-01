const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const css=fs.readFileSync(path.join(root,'frontend','style.css'),'utf8');

test('dashboard desktop usa toda a largura disponível',()=>{
  assert.match(css,/\.dashboard-premium-page\{[\s\S]*?max-width:none!important/);
  assert.match(css,/body:not\(\.public-bg\):not\(\.auth-body\):not\(\.legal-page\) \.main\{[\s\S]*?width:auto!important/);
});

test('controles autenticados possuem contraste escuro global e autofill legível',()=>{
  assert.match(css,/input:not\(\[type="checkbox"\]\)[\s\S]*?background-color:#0b0e12!important/);
  assert.match(css,/select option,[\s\S]*?background:#0b0e12!important;color:#f4f6f8!important/);
  assert.match(css,/input:-webkit-autofill[\s\S]*?-webkit-text-fill-color:#f4f6f8!important/);
});

test('assets 4.4.5 quebram o cache antigo em todas as páginas',()=>{
  const pages=[];
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).forEach(item=>{
    const file=path.join(dir,item.name);
    if(item.isDirectory())walk(file);else if(item.name.endsWith('.html'))pages.push(file);
  });
  walk(path.join(root,'frontend'));
  for(const file of pages){
    const html=fs.readFileSync(file,'utf8');
    if(html.includes('/style.css'))assert.match(html,/style\.css\?v=20260901-v445/,path.relative(root,file));
  }
});
