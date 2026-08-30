const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const frontend=path.join(root,'frontend');
const css=fs.readFileSync(path.join(frontend,'style.css'),'utf8');
const common=fs.readFileSync(path.join(frontend,'js/common.js'),'utf8');
const assinaturaJs=fs.readFileSync(path.join(frontend,'js/assinatura.js'),'utf8');
const assinaturaHtml=fs.readFileSync(path.join(frontend,'pages/assinatura.html'),'utf8');
const tenant=fs.readFileSync(path.join(root,'backend/src/routes/tenant.js'),'utf8');

function htmlFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?htmlFiles(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[])}

test('design system 4.0 usa carvão e âmbar em superfícies principais',()=>{
  assert.match(css,/--bf-carbon:#0f1114/);
  assert.match(css,/--bf-gold:#d4a017/);
  assert.match(css,/\.sidebar[^}]*background:/s);
  assert.match(css,/\.panel,.card/);
  assert.match(css,/\.mobile-appbar/);
  assert.match(css,/\.auth-card/);
  assert.match(css,/\.public-card/);
});

test('shell usa lockup BarberFlow com favicon preservado',()=>{
  assert.match(common,/function brandLockup/);
  assert.match(common,/favicon\.svg\?v=20260830-v332/);
  assert.match(common,/bf-brand-word/);
});

test('todas as páginas carregam o CSS premium versionado',()=>{
  const pages=htmlFiles(frontend);
  assert.equal(pages.length,27);
  for(const file of pages){assert.match(fs.readFileSync(file,'utf8'),/style\.css\?v=20260830-v415/,path.relative(root,file));}
});

test('cartão de assinatura usa checkout externo oficial e não Brick embutido',()=>{
  assert.match(assinaturaHtml,/Checkout oficial Mercado Pago/);
  assert.match(assinaturaHtml,/openMercadoPagoCard/);
  assert.doesNotMatch(assinaturaHtml,/cardPaymentBrick_container|sdk\.mercadopago\.com/);
  assert.match(assinaturaJs,/window\.location\.assign\(r\.checkout_url\)/);
  assert.match(tenant,/CARTAO_CHECKOUT_EXTERNO/);
});
