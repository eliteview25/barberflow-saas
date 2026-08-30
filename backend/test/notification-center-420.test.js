const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const read=(...parts)=>fs.readFileSync(path.join(root,...parts),'utf8');
const service=read('backend','src','services','notificationCenter.js');
const route=read('backend','src','routes','notificacoes.js');
const app=read('backend','src','app.js');
const common=read('frontend','js','common.js');
const css=read('frontend','style.css');

test('central persiste notificações e leitura individual no PostgreSQL',()=>{
  assert.match(service,/CREATE TABLE IF NOT EXISTS notificacoes\(/);
  assert.match(service,/CREATE TABLE IF NOT EXISTS notificacoes_leituras\(/);
  assert.match(service,/PRIMARY KEY\(notificacao_id,usuario_id\)/);
  assert.match(service,/ux_notificacoes_chave_unica/);
  assert.match(read('backend','server.js'),/await ensureNotificationSchema\(\)/);
  assert.match(read('backend','migrar-banco.js'),/await ensureNotificationSchema\(client\)/);
});

test('consulta isola Supermaster, barbearia, papel e usuário',()=>{
  assert.match(service,/n\.audiencia='super_admin' AND \(n\.usuario_id IS NULL OR n\.usuario_id=\$\$\{start\}\)/);
  assert.match(service,/n\.audiencia='tenant' AND n\.barbearia_id=\$\$\{start\+1\}/);
  assert.match(service,/cardinality\(n\.papeis\)=0 OR \$\$\{start\+2\}=ANY\(n\.papeis\)/);
  assert.match(service,/barbeiro_id=\$2 AND papel='barbeiro' AND ativo=true/);
  assert.match(service,/safeLink\(link\)/);
});

test('API autenticada lista e marca notificações como lidas',()=>{
  assert.match(route,/router\.use\(autenticar\)/);
  assert.match(route,/router\.get\('\/'/);
  assert.match(route,/router\.patch\('\/:id\/lida'/);
  assert.match(route,/router\.post\('\/ler-todas'/);
  assert.match(app,/app\.use\('\/api\/notificacoes',notificacoes\)/);
});

test('eventos reais alimentam a central da barbearia e do Supermaster',()=>{
  const external=read('backend','src','services','notifications.js');
  assert.match(external,/await publicarEventoNotificacao\(evento,dados\)/);
  for(const event of ['agendamento_publico_criado','agendamento_cancelado_publico','agendamento_reagendado_publico','pix_manual_pendente','support_ticket_created','support_ticket_updated','nova_barbearia'])assert.match(read('backend','src','routes',event.startsWith('support_ticket_created')?'support.js':event==='support_ticket_updated'?'master.js':event==='nova_barbearia'?'auth.js':'publico.js'),new RegExp(event));
  assert.match(read('backend','src','services','subscriptionPayments.js'),/subscription-pix-paid/);
  assert.match(read('backend','src','services','launchReadiness.js'),/audiencia:'super_admin'/);
});

test('sininho abre painel real, atualiza contador e faz polling',()=>{
  assert.match(common,/api\('\/notificacoes\?limit=30'\)/);
  assert.match(common,/api\(`\/notificacoes\/\$\{id\}\/lida`/);
  assert.match(common,/api\('\/notificacoes\/ler-todas'/);
  assert.match(common,/setInterval\(\(\)=>\{if\(!document\.hidden\)loadNotifications\(\{silent:true\}\)\},60000\)/);
  assert.match(common,/class=\"bf-notification-panel\"/);
  assert.match(css,/\.bf-notification-panel\{[\s\S]*?background:linear-gradient\(155deg,#15191e,#0c0f13\)/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.bf-notification-panel\{top:auto;right:0;bottom:0;width:100%/);
});

test('Supermaster possui sino e navega para a seção indicada',()=>{
  assert.match(read('frontend','master.html'),/master-notification-bell/);
  assert.match(common,/master-mobile-appbar[\s\S]*?master-notification-bell/);
  assert.match(read('frontend','js','master.js'),/window\.openMasterSection=switchSection/);
  assert.match(read('frontend','js','master.js'),/new URLSearchParams\(location\.search\)\.get\('secao'\)/);
});
