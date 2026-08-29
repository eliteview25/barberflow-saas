const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('WhatsApp do suporte é configurável pelo Supermaster e consumido pela barbearia',()=>{
  const master=read('backend/src/routes/master.js');
  const support=read('backend/src/routes/support.js');
  const service=read('backend/src/services/platformSettings.js');
  const html=read('frontend/master.html');
  const tenantHtml=read('frontend/pages/suporte.html');
  assert.match(master,/\/settings\/support/);
  assert.match(master,/setPlatformSetting\('support_whatsapp'/);
  assert.match(support,/getSupportSettings/);
  assert.match(service,/platform_settings/);
  assert.match(html,/id="masterSupportWhatsapp"/);
  assert.match(tenantHtml,/id="supportWhatsappButton"/);
});

test('Página pública permite WhatsApp opcional e localização com Google Maps',()=>{
  const config=read('frontend/pages/configuracoes.html');
  const publicHtml=read('frontend/publico.html');
  const publicJs=read('frontend/js/publico.js');
  const tenant=read('backend/src/routes/tenant.js');
  assert.match(config,/id="mostrar_whatsapp_publico"/);
  assert.match(config,/id="mostrar_mapa_publico"/);
  assert.match(config,/id="configMapDirections"/);
  assert.match(publicHtml,/id="publicLocationCard"/);
  assert.match(publicJs,/google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(publicJs,/mostrar_whatsapp_publico!==false/);
  assert.match(tenant,/mostrar_whatsapp_publico/);
  assert.match(tenant,/mostrar_mapa_publico/);
});

test('Starter mantém página pública simples disponível',()=>{
  const publico=read('backend/src/routes/publico.js');
  const catalog=read('backend/src/services/planCatalog.js');
  assert.match(catalog,/starter[\s\S]*pagina_publica_simples/);
  assert.doesNotMatch(publico,/plano_efetivo==='starter'\)return null/);
});
