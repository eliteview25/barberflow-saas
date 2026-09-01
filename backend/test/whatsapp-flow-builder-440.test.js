const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const service=read('backend/src/services/whatsappFlows.js');
const route=read('backend/src/routes/whatsapp.js');
const runtime=read('backend/src/services/whatsapp.js');
const html=read('frontend/pages/automacoes.html');
const js=read('frontend/js/automacoes.js');
const css=read('frontend/style.css');
const lifecycle=read('backend/src/services/tenantLifecycle.js');

test('4.4 cria fluxos WhatsApp isolados por barbearia com somente um ativo',()=>{
  assert.match(service,/CREATE TABLE IF NOT EXISTS whatsapp_fluxos/);
  assert.match(service,/barbearia_id INTEGER NOT NULL REFERENCES barbearias\(id\) ON DELETE CASCADE/);
  assert.match(service,/CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_fluxos_ativo_tenant[\s\S]*WHERE ativo=true/);
  assert.match(service,/WHERE id=\$1 AND barbearia_id=\$2/);
  assert.match(lifecycle,/'whatsapp_fluxos'/);
});

test('CRUD do construtor usa tenant autenticado e recurso automacoes',()=>{
  for(const endpoint of ["'/flows'","'/flows/:id'","'/flows/:id/activate'","'/flows/:id/duplicate'"])assert.match(route,new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(route,/flows\.listFlows\(req\.usuario\.barbearia_id\)/);
  assert.match(route,/flows\.createFlow\(req\.usuario\.barbearia_id/);
  assert.match(route,/flows\.updateFlow\(req\.usuario\.barbearia_id/);
  assert.match(route,/exigirPapel\('dono','gerente'\),exigirRecurso\('automacoes'\)/);
  assert.doesNotMatch(route,/json\(\{erro:e\.message/);
});

test('mensagens personalizadas preservam variáveis críticas de opções e pagamento',()=>{
  assert.match(service,/REQUIRED_VARS=\{servico:\['opcoes'\],barbeiro:\['opcoes'\],horario:\['opcoes'\],pagamento:\['opcoes'\],reserva_pix:\['valor','pix_chave'\],reserva_mercado_pago:\['link'\]\}/);
  assert.match(service,/ALLOWED_VARS=new Set/);
  assert.match(service,/Variável não permitida/);
  assert.match(service,/precisa manter/);
});

test('runtime do WhatsApp usa o fluxo ativo sem remover validações transacionais',()=>{
  assert.match(runtime,/wf\.getActiveFlow\(integ\.barbearia_id\)/);
  assert.match(runtime,/wf\.renderMessage\(flow,'servico'/);
  assert.match(runtime,/wf\.renderMessage\(activeFlow,'pagamento'/);
  assert.match(runtime,/wf\.renderMessage\(currentFlow,'confirmacao'/);
  assert.match(runtime,/createTrustedAppointment/);
  assert.match(runtime,/lockSlot/);
  assert.match(runtime,/slotContext/);
});

test('painel possui editor visual, prévia, variáveis e criação de múltiplos fluxos',()=>{
  for(const id of ['whatsappFlowBuilder','flowList','newFlowBtn','flowNodeRail','flowFields','flowVariables','flowPreviewBubble','saveFlowBtn','activateFlowBtn','duplicateFlowBtn'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/const flowNodes=\[/);
  assert.match(js,/flowVarNames=/);
  assert.match(js,/\/whatsapp\/flows/);
  assert.match(js,/Duplicar|duplicateFlowBtn/);
  assert.doesNotMatch(js,/\bprompt\s*\(|\balert\s*\(|\bconfirm\s*\(/);
});

test('construtor reflowa no mobile sem depender de hover',()=>{
  assert.match(css,/\.flow-builder-grid\{display:grid/);
  assert.match(css,/@media\(max-width:650px\)[\s\S]*\.flow-builder-toolbar[\s\S]*\.flow-editor-actions/);
  assert.match(css,/\.flow-node-rail\{[\s\S]*flex-direction:row;overflow-x:auto/);
  assert.match(css,/\.flow-phone-preview/);
});
