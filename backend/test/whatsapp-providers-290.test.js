const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('central WhatsApp oferece os quatro provedores e um ativo por tenant',()=>{
  const s=read('src/services/whatsappProviders.js');
  assert.match(s,/PROVIDERS=\['meta','360dialog','twilio','evolution'\]/);
  assert.match(s,/whatsapp_conexoes/);
  assert.match(s,/barbearia_id=\$1 AND provedor=\$2/);
  assert.match(s,/whatsapp_provedor/);
});

test('segredos dos provedores ficam criptografados e não são serializados em publicRow',()=>{
  const s=read('src/services/whatsappProviders.js');
  assert.match(s,/secretValue\?encrypt\(secretValue\)/);
  assert.match(s,/webhookToken\?encrypt\(webhookToken\)/);
  const publicFn=(s.split('function publicRow(r){',2)[1]||'').split('function secret',1)[0];
  assert.doesNotMatch(publicFn,/secret_enc|webhook_token_enc/);
});

test('Meta 360dialog Twilio e Evolution possuem adaptadores reais de envio',()=>{
  const s=read('src/services/whatsappProviders.js');
  assert.match(s,/graph\.facebook\.com/);
  assert.match(s,/waba-v2\.360dialog\.io\/messages/);
  assert.match(s,/api\.twilio\.com\/2010-04-01\/Accounts/);
  assert.match(s,/StatusCallback/);
  assert.match(s,/qr\.sendTextByInstance/);
});

test('webhooks possuem validação adequada e processamento unificado',()=>{
  const r=read('src/routes/whatsapp.js'),s=read('src/services/whatsappProviders.js');
  assert.match(r,/x-hub-signature-256/);
  assert.match(r,/webhook\/360dialog\/:token/);
  assert.match(r,/webhook\/twilio\/:token/);
  assert.match(r,/webhook\/evolution\/:token/);
  assert.match(s,/x-twilio-signature/);
  assert.match(s,/timingSafeEqual/);
  assert.match(r,/enqueueGeneric/);
});

test('conectar ativar e desconectar provedores exigem step-up',()=>{
  const r=read('src/routes/whatsapp.js');
  assert.match(r,/providers\/:provider\/connect'.*exigirStepUp/s);
  assert.match(r,/providers\/:provider\/activate'.*exigirStepUp/s);
  assert.match(r,/delete\('\/providers\/:provider'.*exigirStepUp/s);
  assert.match(r,/providers\/evolution\/start'.*exigirStepUp/s);
});

test('frontend permite escolha explícita entre quatro provedores e explica oficial vs alternativo',()=>{
  const h=read('../frontend/pages/automacoes.html'),j=read('../frontend/js/automacoes.js');
  for(const name of ['Meta Cloud API','360dialog','Twilio','Evolution'])assert.ok(h.includes(name)||j.includes(name),name);
  assert.match(h,/OFICIAL/);
  assert.match(h,/ALTERNATIVO/);
  assert.match(j,/\/whatsapp\/providers/);
  assert.match(j,/\/activate/);
});

test('lembretes e Marketing usam o provedor ativo em vez de tabela Meta fixa',()=>{
  const a=read('src/routes/automacoes.js'),m=read('src/services/marketing.js');
  assert.match(a,/activeConnection/);
  assert.match(m,/activeConnection/);
  assert.match(m,/wp\.sendTemplate|wp\.sendText/);
});

test('rotas legadas principais continuam disponíveis para frontend em cache',()=>{
  const r=read('src/routes/whatsapp.js');
  for(const route of ["'/conectar'","'/conexao'","'/qr/status'","'/qr/iniciar'","'/qr/conexao'","'/qr/teste'"])assert.ok(r.includes(route),route);
});

test('Evolution 2.3.7 envia texto no formato exigido pela API',()=>{
  const s=read('src/services/whatsappQr.js');
  assert.match(s,/body:\{number:digits\(to\),text:String\(text\)\.slice\(0,4000\),delay:400,linkPreview:true\}/);
  assert.doesNotMatch(s,/textMessage:\{text:/);
});



test('Evolution usa webhook único compatível com a rota BarberFlow',()=>{
  const s=read('src/services/whatsappQr.js');
  assert.match(s,/webhookByEvents:false/);
  assert.doesNotMatch(s,/webhookByEvents:true/);
  assert.match(s,/MESSAGES_UPSERT/);
});

test('webhook Evolution prefere remoteJidAlt com número real em sessões LID',()=>{
  const r=read('src/routes/whatsapp.js');
  assert.match(r,/remoteJidAlt/);
  assert.match(r,/@s\.whatsapp\.net/);
});


test('Evolution registra webhook v2 usando envelope webhook e valida persistencia',()=>{
  const s=read('src/services/whatsappQr.js');
  assert.match(s,/\{webhook:\{enabled:true,url:target,byEvents:false,base64:false,events\}\}/);
  assert.match(s,/\/webhook\/find\/\$\{encodeURIComponent\(r\.instance_name\)\}/);
  assert.match(s,/Evolution não persistiu o webhook de entrada corretamente/);
});

test('status Evolution repara webhook quando a sessao esta conectada',()=>{
  const r=read('src/routes/whatsapp.js');
  assert.match(r,/if\(d\.conectado\).*qr\.setWebhook\(tenant,url\)/s);
  assert.match(r,/webhook_ok/);
  assert.match(r,/webhook_error/);
});


test('webhook Evolution autentica pelo token mesmo se status local estiver atrasado',()=>{
  const providers=read('src/services/whatsappProviders.js');
  assert.match(providers,/WHERE provedor=\$1 AND webhook_token_hash=\$2`/);
  assert.doesNotMatch(providers,/webhook_token_hash=\$2 AND status='conectado'/);
});

test('status Evolution expõe diagnóstico da última entrada',()=>{
  const routes=read('src/routes/whatsapp.js'),frontend=read('../frontend/js/automacoes.js');
  assert.match(routes,/ultimo_webhook_em/);
  assert.match(routes,/ultimo_webhook_evento/);
  assert.match(frontend,/Nenhuma mensagem de entrada chegou ao BarberFlow ainda/);
});
