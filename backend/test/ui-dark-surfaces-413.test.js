const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const css=fs.readFileSync(path.join(root,'frontend','style.css'),'utf8');

test('Financeiro e WhatsApp não deixam cards principais no tema branco',()=>{
  for(const selector of ['.finance-chart-card','.provider-choice-card','.provider-config','.provider-webhook-box','.provider-compat-grid>div','.qr-provider-visual']){
    assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[\\s\\S]*?background:linear-gradient\\(145deg,#12151a,#0d1014\\)!important'));
  }
});

test('branco é preservado apenas no suporte visual de QR Code',()=>{
  assert.match(css,/\.qr-provider-visual img,[\s\S]*?\.pix-qr-wrap\{background:#fff!important/);
});

test('prévia da foto do dono é compacta nas Configurações',()=>{
  assert.match(css,/\.owner-profile-avatar\{[\s\S]*?width:56px!important[\s\S]*?height:56px!important/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.owner-profile-avatar\{width:42px!important;height:42px!important/);
});
