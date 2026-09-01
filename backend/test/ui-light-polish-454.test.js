const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'frontend/style.css'),'utf8');
const marker='/* =========================================================\n   EliteFlow 4.5.4';
const markerIndex=css.indexOf(marker);
const light454=markerIndex>=0?css.slice(markerIndex):'';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('4.5.4 é uma camada estritamente do modo claro',()=>{
  assert.ok(markerIndex>0);
  assert.match(light454,/Regras estritamente limitadas a data-bf-theme="light"/);
  assert.doesNotMatch(light454,/html\[data-bf-theme="dark"\]/);
});

test('sidebar passa a acompanhar o tema claro em desktop e mobile',()=>{
  assert.match(light454,/html\[data-bf-theme="light"\] :is\(\.sidebar,\.master-sidebar-v2\)\{[\s\S]*background:#ffffff!important/);
  assert.match(light454,/color-scheme:light!important/);
  assert.match(light454,/\.menu a\.active,\.menu-group-toggle\.active,\.master-side-link\.active/);
  assert.match(light454,/\.sidebar-plan-card\{[\s\S]*background:linear-gradient\(145deg,#fffaf0,#ffffff\)!important/);
  assert.match(light454,/@media\(max-width:760px\)[\s\S]*html\[data-bf-theme="light"\] :is\(\.sidebar,\.master-sidebar-v2\)/);
});

test('Clientes elimina remanescentes carvão no tema claro',()=>{
  for(const selector of ['.premium-client-kpis article','.client-directory-panel','.client-search','.client-premium-table','.client-icon-action','.client-card-metrics>div']){
    assert.ok(light454.includes(selector),selector);
  }
  assert.match(light454,/\.premium-client-kpis article\{[\s\S]*background:#fff!important/);
  assert.match(light454,/\.client-search\{[\s\S]*background:var\(--lf-surface-low\)!important/);
  assert.match(light454,/\.client-card-actions \.btn\{background:transparent!important/);
});

test('WhatsApp e construtor de fluxo usam superfícies claras e seleção por borda',()=>{
  for(const selector of ['.provider-choice-card','.provider-config','.provider-webhook-box','.qr-provider-visual','.flow-list-card','.flow-node','.flow-message-editor','.ai-roadmap-card']){
    assert.ok(light454.includes(selector),selector);
  }
  assert.match(light454,/\.provider-choice-card\.selected,\.provider-choice-card\.active-provider\)\{[\s\S]*background:#fff!important[\s\S]*border-color:var\(--lf-brand\)!important/);
  assert.match(light454,/\.flow-list-card\.selected\{[\s\S]*background:#fff!important[\s\S]*border-color:var\(--lf-brand\)!important/);
  assert.match(light454,/\.flow-node:hover,html\[data-bf-theme="light"\] \.flow-node\.selected\{background:#fff!important;border-color:var\(--lf-brand\)!important/);
});

test('páginas administrativas recebem cache novo do CSS sem trocar JS desnecessariamente',()=>{
  for(const file of ['frontend/index.html','frontend/master.html','frontend/pages/clientes.html','frontend/pages/automacoes.html']){
    const html=read(file);
    assert.match(html,/style\.css\?v=20260901-v454/);
    assert.match(html,/theme\.js\?v=20260901-v453/);
  }
});
