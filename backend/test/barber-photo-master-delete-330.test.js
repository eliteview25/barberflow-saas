const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('barbeiros aceitam foto segura e o boot prepara a coluna',()=>{
  const route=read('backend/src/routes/barbeiros.js');
  const service=read('backend/src/services/barberProfiles.js');
  const server=read('backend/server.js');
  assert.match(route,/safeHttpUrl\(body\.foto_url\)/);
  assert.match(route,/foto_url/);
  assert.match(service,/ALTER TABLE barbeiros ADD COLUMN IF NOT EXISTS foto_url TEXT/);
  assert.match(server,/ensureBarberProfileSchema/);
});

test('upload de foto do barbeiro usa pipeline seguro de imagens',()=>{
  const uploads=read('backend/src/routes/uploads.js');
  assert.match(uploads,/\/barbeiro-imagem/);
  assert.match(uploads,/folderSuffix:'barbeiros'/);
  assert.match(uploads,/exigirAssinatura/);
  assert.match(uploads,/image\/png/);
  assert.match(uploads,/image\/jpeg/);
});

test('página pública recebe e mostra foto do profissional',()=>{
  const route=read('backend/src/routes/publico.js');
  const html=read('frontend/publico.html');
  const js=read('frontend/js/publico.js');
  const css=read('frontend/style.css');
  assert.match(route,/SELECT id,nome,foto_url FROM barbeiros/);
  assert.match(html,/id="barbeiroCards"/);
  assert.match(js,/renderBarberCards/);
  assert.match(js,/public-barber-photo/);
  assert.match(css,/\.public-barber-grid\{/);
});

test('cadastro de barbeiro permite enviar e remover foto',()=>{
  const html=read('frontend/pages/barbeiros.html');
  const js=read('frontend/js/barbeiros.js');
  assert.match(html,/id="foto_file"/);
  assert.match(html,/id="fotoPreview"/);
  assert.match(js,/\/api\/uploads\/barbeiro-imagem/);
  assert.match(js,/foto_url/);
  assert.match(js,/removerFotoBarbeiro/);
});

test('exclusão de barbearia não pede nome e exige 2FA fresco',()=>{
  const route=read('backend/src/routes/master.js');
  const front=read('frontend/js/master.js');
  const app=read('backend/src/app.js');
  assert.match(route,/exigir2FAExclusao/);
  assert.match(route,/verifyTotp\(secret,req\.body\?\.mfa_code\)/);
  assert.doesNotMatch(route,/Digite exatamente o nome da barbearia/);
  assert.doesNotMatch(front,/prompt\(.*nome da barbearia/);
  assert.match(front,/mode:'totp'/);
  assert.match(front,/mfa_code:code/);
  assert.match(front,/Não é necessário digitar o nome da barbearia/);
  assert.match(app,/req\.method==='DELETE'\?sensitive/);
});
