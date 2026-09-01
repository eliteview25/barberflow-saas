const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'frontend/style.css'),'utf8');
const marker='/* =========================================================\n   EliteFlow 4.5.3';
const markerIndex=css.indexOf(marker);
const nextMarker='/* =========================================================\n   EliteFlow 4.5.4';
const nextMarkerIndex=css.indexOf(nextMarker,markerIndex+1);
const dark453=markerIndex>=0?css.slice(markerIndex,nextMarkerIndex>=0?nextMarkerIndex:undefined):'';

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

test('4.5.3 preserva integralmente o CSS da versão clara 4.5.2',()=>{
  assert.ok(markerIndex>0);
  const baseHash=crypto.createHash('sha256').update(css.slice(0,markerIndex).trimEnd()).digest('hex');
  assert.equal(baseHash,'7afe66d5cee1a99dded10ec92c6abc0e5c31f7dabdb9859312ee6f126701e123');
  assert.doesNotMatch(dark453,/html\[data-bf-theme="light"\]/);
});

test('camadas do modo escuro ficam progressivamente mais claras',()=>{
  const layers=['#0a0c0f','#11151a','#14191f','#171c22','#1c222a'];
  for(let index=1;index<layers.length;index++)assert.ok(luminance(layers[index])>luminance(layers[index-1]));
  for(const token of ['--df-canvas:#0a0c0f','--df-surface:#11151a','--df-surface-soft:#14191f','--df-surface-raised:#171c22','--df-surface-overlay:#1c222a'])assert.ok(dark453.includes(token),token);
});

test('textos e estados centrais passam contraste WCAG AA',()=>{
  const pairs=[
    ['#f5f7fa','#11151a'],['#d0d5dd','#11151a'],['#98a2b3','#11151a'],['#8b95a3','#171c22'],
    ['#f6c85f','#2a2110'],['#75e0a7','#102a20'],['#84adff','#10233f'],
    ['#fec84b','#302407'],['#fda29b','#351513'],['#c3b5fd','#231a40'],['#0a0c0f','#efb11f']
  ];
  for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${foreground} em ${background}`);
});

test('borda dos campos alcança contraste não textual de 3 para 1',()=>{
  assert.ok(contrast('#5b6878','#171c22')>=3);
  assert.match(dark453,/--df-control-border:#5b6878/);
});

test('modo principal cobre módulos, conteúdo dinâmico, Supermaster e mobile',()=>{
  for(const selector of ['.premium-kpi','.finance-chart-card','.agenda-event.status-confirmado','.provider-choice-card','.flow-list-card','.gateway-card','.subscription-checkout-modal','.bf-notification-panel','.security-card','.support-ticket','.master-tabs-modern','.master-table-wrap-v2','.mobile-bottom-nav'])assert.ok(dark453.includes(selector),selector);
});
