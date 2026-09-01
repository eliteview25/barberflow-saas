const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('agenda mobile usa card repaginado com pessoa, metadados e ações',()=>{
  const js=read('frontend/js/agendamentos.js');
  const css=read('frontend/style.css');
  assert.match(js,/agenda-mobile-person/);
  assert.match(js,/agenda-mobile-meta/);
  assert.match(js,/agenda-mobile-actions/);
  assert.match(js,/agenda-open-btn/);
  assert.match(css,/\.agenda-mobile-card\{[\s\S]*border-left:3px solid var\(--agenda-accent\)/);
  assert.match(css,/\.agenda-mobile-actions\{display:grid/);
});

test('clientes mobile usam contato, métricas e ações com área de toque adequada',()=>{
  const js=read('frontend/js/clientes.js');
  const css=read('frontend/style.css');
  assert.match(js,/client-mobile-card/);
  assert.match(js,/client-wa-btn/);
  assert.match(js,/client-edit-btn/);
  assert.match(js,/client-delete-btn/);
  assert.match(css,/\.client-mobile-card \.client-card-actions\{display:grid!important/);
  assert.match(css,/\.client-mobile-card \.client-card-actions \.btn\{height:40px!important/);
});

test('serviços possuem cards próprios no mobile sem remover tabela desktop',()=>{
  const html=read('frontend/pages/servicos.html');
  const js=read('frontend/js/servicos.js');
  const css=read('frontend/style.css');
  assert.match(html,/id="serviceCards" class="service-card-grid"/);
  assert.match(html,/service-table-wrap/);
  assert.match(js,/service-card-metrics/);
  assert.match(js,/service-card-actions/);
  assert.match(css,/\.service-card-grid\{display:none\}/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.service-card-grid\{display:grid!important/);
});

test('seleções autenticadas não usam fundo branco e selected usa borda',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/\.field select,[\s\S]*background:transparent!important/);
  assert.match(css,/\.slot\.selected\{[\s\S]*background:transparent!important;[\s\S]*border-color:#e1aa1d!important/);
});

test('CSS das páginas alteradas aponta para v454',()=>{
  for(const rel of ['frontend/pages/agendamentos.html','frontend/pages/clientes.html','frontend/pages/servicos.html']){
    const html=read(rel);
    assert.match(html,/style\.css\?v=20260901-v454/);
    assert.match(html,/common\.js\?v=20260901-v453/);
  }
});
