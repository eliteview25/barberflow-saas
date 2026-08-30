const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..','..','frontend');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('4.1 dashboard replica estrutura do mockup aprovado no desktop',()=>{
  const html=read('index.html'),css=read('style.css'),js=read('script.js'),common=read('js/common.js');
  assert.match(html,/premium-kpi-grid/);
  assert.match(html,/dashboard-premium-grid/);
  assert.match(html,/Performance dos Barbeiros/);
  assert.match(html,/Faturamento dos últimos 7 dias/);
  assert.match(css,/\.bf-premium-topbar/);
  assert.match(css,/\.premium-bar-chart/);
  assert.match(js,/premium-bar-chart/);
  assert.match(common,/bf-topbar-bell/);
  assert.match(common,/userAvatarHtml\(u/);
});

test('4.1 mobile usa appbar, perfil, atalhos, resumo e navegação inferior',()=>{
  const html=read('index.html'),css=read('style.css'),common=read('js/common.js');
  assert.match(html,/mobile-dashboard-profile/);
  assert.match(html,/mobile-next-card/);
  assert.match(html,/mobile-action-grid/);
  assert.match(html,/mobile-daily-summary/);
  assert.match(common,/mobile-bottom-nav/);
  assert.match(common,/mobile-bell/);
  assert.match(css,/grid-template-columns:repeat\(5,1fr\)/);
  assert.match(css,/\.mobile-bottom-nav \.active/);
});

test('identidade 4.1 usa Poppins, carvão e âmbar',()=>{
  const css=read('style.css');
  assert.match(css,/family=Poppins/);
  assert.match(css,/--bf-bg:#080a0d|--bf-bg:\s*#080a0d/);
  assert.match(css,/--bf-gold[^:]*:\s*#d4a017/i);
});
