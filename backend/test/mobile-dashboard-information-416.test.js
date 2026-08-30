const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('frontend/index.html');
const js=read('frontend/script.js');
const css=read('frontend/style.css');

test('início mobile possui operação, destaques, semana e próximos horários',()=>{
  for(const id of ['mobileStatusGrid','mobileRoleHighlights','mobileWeekChart','mobileUpcomingList'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/renderMobileStatus\(d\);renderMobileHighlights\(d\);renderMobileWeek\(d\);renderMobileUpcoming\(d\)/);
});

test('destaques mobile respeitam os dados relevantes de cada perfil',()=>{
  assert.match(js,/\['dono','gerente'\]\.includes\(role\)[\s\S]*?Faturamento no mês[\s\S]*?Previsto hoje[\s\S]*?Ocupação/);
  assert.match(js,/role==='recepcao'[\s\S]*?Estrutura da recepção[\s\S]*?Profissionais[\s\S]*?Serviços/);
  assert.match(js,/Meu desempenho[\s\S]*?Comissão hoje[\s\S]*?Comissão no mês[\s\S]*?Minha ocupação/);
});

test('painéis novos são exclusivos do mobile e continuam escuros',()=>{
  assert.match(css,/\.mobile-home-panel\{display:none\}/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.mobile-home-panel\{display:block[\s\S]*?background:linear-gradient\(145deg,#12151a,#0d1014\)/);
  assert.match(css,/@media\(max-width:350px\)\{[\s\S]*?\.mobile-status-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
