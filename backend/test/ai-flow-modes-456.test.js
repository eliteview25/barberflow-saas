const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('4.5.6 persiste três modos por barbearia e migra a configuração anterior com segurança',()=>{
  const config=read('backend/src/services/aiConfig.js');
  assert.match(config,/MODOS_ATENDIMENTO=\['fluxo','ia','ambos'\]/);
  assert.match(config,/modo_atendimento VARCHAR\(12\) NOT NULL DEFAULT 'fluxo'/);
  assert.match(config,/CASE WHEN ativo THEN 'ambos' ELSE 'fluxo' END WHERE modo_atendimento IS NULL/);
  assert.match(config,/function modeUsesFlow/);
  assert.match(config,/function modeUsesAi/);
});

test('API aceita somente modos conhecidos, exige a chave para IA e registra a escolha na auditoria',()=>{
  const route=read('backend/src/routes/ai.js');
  assert.match(route,/MODOS_ATENDIMENTO\.includes\(requested\)/);
  assert.match(route,/modeUsesAi\(requested\)&&!available\(\)/);
  assert.match(route,/modo_atendimento:config\.modo_atendimento/);
  assert.match(route,/fluxo_ativo:modeUsesFlow/);
  assert.match(route,/ia_ativa:modeUsesAi/);
});

test('WhatsApp respeita Fluxo, IA e Ambos e força fluxo fora do Premium',()=>{
  const runtime=read('backend/src/services/whatsapp.js');
  assert.match(runtime,/ctx\.recursos\.includes\('ia_whatsapp'\)\?savedMode:'fluxo'/);
  assert.match(runtime,/useFlow=modeUsesFlow\(mode\),useAi=modeUsesAi\(mode\)/);
  assert.match(runtime,/!s&&useAi&&\(!flowRestart\|\|mode==='ia'\)/);
  assert.match(runtime,/if\(!s&&!useFlow\)return sendText/);
  assert.match(runtime,/const aiOnly=options\.mode==='ia'/);
});

test('painel oferece dois controles independentes, impede ambos desligados e reflowa no mobile',()=>{
  const html=read('frontend/pages/automacoes.html'),js=read('frontend/js/automacoes.js'),css=read('frontend/style.css');
  for(const id of ['flowAtivo','aiAtivo','aiModeSummary','aiAdvancedSettings'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/return aiEls\.flow\.checked\?\(aiEls\.ativo\.checked\?'ambos':'fluxo'\):'ia'/);
  assert.match(js,/if\(!aiEls\.flow\.checked&&!aiEls\.ativo\.checked\)/);
  assert.match(js,/modo_atendimento:modo/);
  assert.match(css,/@media\(max-width:760px\)\{\.ai-mode-selector[\s\S]*\.ai-mode-grid\{grid-template-columns:1fr\}/);
});
