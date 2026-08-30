const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const frontend=path.join(root,'frontend');

function htmlFiles(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...htmlFiles(p));
    else if(entry.isFile() && entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

test('favicon BarberFlow existe nos formatos principais',()=>{
  for(const name of ['favicon.svg','favicon.ico','apple-touch-icon.png']){
    const p=path.join(frontend,name);
    assert.equal(fs.existsSync(p),true,`${name} ausente`);
    assert.ok(fs.statSync(p).size>100,`${name} vazio ou inválido`);
  }
});

test('todas as páginas HTML usam favicon versionado',()=>{
  const pages=htmlFiles(frontend);
  assert.ok(pages.length>=20);
  const missing=[];
  for(const p of pages){
    const html=fs.readFileSync(p,'utf8');
    if(!/rel="icon"[^>]+favicon\.svg\?v=20260830-v332/i.test(html)) missing.push(path.relative(frontend,p));
    if(!/rel="apple-touch-icon"[^>]+apple-touch-icon\.png\?v=20260830-v332/i.test(html)) missing.push(`${path.relative(frontend,p)} (apple)`);
  }
  assert.deepEqual(missing,[]);
});

test('favicon SVG preserva cores da identidade BarberFlow',()=>{
  const svg=fs.readFileSync(path.join(frontend,'favicon.svg'),'utf8');
  assert.match(svg,/#111827/i);
  assert.match(svg,/#F59E0B/i);
});
