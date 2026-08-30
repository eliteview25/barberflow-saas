const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('dashboard 3.2 personaliza gerente recepção e barbeiro sem chamar config proibida',()=>{
  const js=read('frontend/script.js');
  assert.match(js,/role==='recepcao'/);
  assert.match(js,/role==='barbeiro'/);
  assert.match(js,/Comissão hoje/);
  assert.match(js,/Atrasados/);
  assert.match(js,/\['dono','gerente'\]\.includes\(role\)/);
  assert.doesNotMatch(js,/const c=await api\('\/configuracoes'\);E\('publicLink'\)/);
});

test('API do dashboard entrega métricas operacionais por perfil e isola barbeiro',()=>{
  const route=read('backend/src/routes/tenant.js');
  assert.match(route,/aguardando_confirmacao/);
  assert.match(route,/confirmados_hoje/);
  assert.match(route,/em_atendimento_hoje/);
  assert.match(route,/atrasados_hoje/);
  assert.match(route,/comissao_hoje/);
  assert.match(route,/Perfil de barbeiro não está vinculado/);
  assert.match(route,/a\.barbeiro_id=\$2/);
});

test('Supermaster usa SVG e ganhou visão de risco e mix de planos',()=>{
  const html=read('frontend/master.html');
  const common=read('frontend/js/common.js');
  assert.match(html,/master-attention-grid/);
  assert.match(html,/mInadimplentes/);
  assert.match(html,/mPlanMixMini/);
  assert.match(html,/data-bf-icon="building"/);
  assert.doesNotMatch(html,/🏪|📅|💳|🔐|👤|📈|📱/);
  assert.match(common,/hydrateIcons/);
  assert.match(common,/iconSVG\('card',16\)/);
});

test('mobile 3.2 trata 320px sem esconder problema com overflow global',()=>{
  const css=read('frontend/style.css');
  const assinatura=read('frontend/pages/assinatura.html');
  assert.match(css,/@media\(max-width:340px\)/);
  assert.match(css,/\.main,\.master-main-v2\{padding-left:8px;padding-right:8px\}/);
  assert.match(css,/\.table td\{grid-template-columns:1fr/);
  assert.match(css,/\.feature-matrix-wrap\{overflow-x:auto!important/);
  assert.match(assinatura,/table-wrap feature-matrix-wrap/);
  assert.match(css,/\.master-section \.actions\{min-width:0!important/);
});
