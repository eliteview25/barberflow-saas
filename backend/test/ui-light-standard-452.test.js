const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'frontend/style.css'),'utf8');
const marker='/* =========================================================\n   EliteFlow 4.5.2';
const markerIndex=css.indexOf(marker);
const light452=markerIndex>=0?css.slice(markerIndex):'';

function luminance(hex){
  const rgb=hex.replace('#','').match(/../g).map(value=>{
    const channel=parseInt(value,16)/255;
    return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
  });
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}

function contrast(foreground,background){
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
}

test('4.5.2 acrescenta somente regras do modo claro ao CSS anterior',()=>{
  assert.ok(markerIndex>0);
  const baseHash=crypto.createHash('sha256').update(css.slice(0,markerIndex).trimEnd()).digest('hex');
  assert.equal(baseHash,'d4c60375a52b506610c93395e7c2396017a0b6fbf9db1ec1ebabd8f57e2e1a44');
  assert.match(light452,/Alterações restritas ao tema claro/);
});

test('paleta clara possui camadas, controles e cores semânticas próprias',()=>{
  for(const token of ['--lf-canvas:#f7f8fa','--lf-surface:#ffffff','--lf-surface-low:#fafbfc','--lf-text:#101828','--lf-muted:#667085','--lf-control-border:#8b95a5','--lf-success-bg:#ecfdf3','--lf-danger-bg:#fef3f2']){
    assert.ok(light452.includes(token),token);
  }
  assert.match(light452,/Canvas limpo/);
  assert.match(light452,/Estados semânticos/);
});

test('combinações centrais de texto do modo claro passam contraste WCAG AA',()=>{
  const pairs=[
    ['#101828','#ffffff'],['#344054','#ffffff'],['#667085','#ffffff'],
    ['#667085','#f7f8fa'],['#027a48','#ecfdf3'],['#175cd3','#eff8ff'],
    ['#b54708','#fffaeb'],['#b42318','#fef3f2'],['#16120a','#e9aa1a']
  ];
  for(const [foreground,background] of pairs){
    assert.ok(contrast(foreground,background)>=4.5,`${foreground} em ${background}`);
  }
});

test('tema claro cobre módulos principais, conteúdo dinâmico e Supermaster',()=>{
  for(const selector of ['.premium-kpi','.finance-panel','.agenda-event.status-confirmado','.provider-choice-card','.flow-list-card','.gateway-card','.subscription-checkout-modal','.bf-notification-panel','.security-card','.support-ticket','.master-tabs-modern','.master-table-wrap-v2','.mobile-bottom-nav']){
    assert.ok(light452.includes(selector),selector);
  }
});

test('sidebar preserva superfície carvão no modo claro',()=>{
  assert.match(light452,/html\[data-bf-theme="light"\] :is\(\.sidebar,\.master-sidebar-v2\)\{color-scheme:dark\}/);
  assert.match(light452,/\.bf-theme-control-sidebar\)\{background:#0e1115!important/);
});
