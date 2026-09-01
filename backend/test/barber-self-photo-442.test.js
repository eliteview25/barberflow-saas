const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('login usa foto do cadastro profissional como fallback do barbeiro',()=>{
  const auth=read('backend/src/routes/auth.js');
  assert.match(auth,/COALESCE\(NULLIF\(u\.foto_url,''\), br\.foto_url\) AS foto_perfil_url/);
  assert.match(auth,/LEFT JOIN barbeiros br[\s\S]*br\.id = u\.barbeiro_id[\s\S]*br\.barbearia_id = u\.barbearia_id/);
  assert.match(auth,/usuario\.foto_perfil_url \|\| usuario\.foto_url \|\| null/);
});

test('auth me mantém foto profissional atualizada sem quebrar isolamento do tenant',()=>{
  const auth=read('backend/src/routes/auth.js');
  assert.match(auth,/COALESCE\(NULLIF\(u\.foto_url,''\), br\.foto_url\) AS foto_url/);
  assert.match(auth,/br\.barbearia_id = u\.barbearia_id/);
});

test('chrome atualiza também a foto do perfil mobile após sincronizar sessão',()=>{
  const common=read('frontend/js/common.js');
  assert.match(common,/getElementById\('mobileOwnerAvatar'\)/);
  assert.match(common,/mobile\.innerHTML=userAvatarHtml\(u,'mobile-owner'\)/);
  assert.match(common,/refreshCurrentUserChrome\(\)\.then\(updateChromeUser\)/);
});
