const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Supermaster tem uma área própria de Segurança e múltiplos autenticadores TOTP',()=>{
  const html=read('frontend/master.html');
  const common=read('frontend/js/common.js');
  for(const app of ['Google Authenticator','Microsoft Authenticator','Authy','1Password','Bitwarden','Aegis / FreeOTP'])assert.match(html,new RegExp(app.replace('/','\\/')));
  assert.match(html,/id="seguranca-master-sec"/);
  assert.match(common,/data-section="seguranca-master-sec"/);
  assert.match(html,/Trocar aplicativo \/ gerar nova chave/);
});

test('drawer mobile do Supermaster esconde a segunda marca desktop',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/\.master-sidebar-v2 \.desktop-logo\{display:none!important\}/);
  assert.match(css,/\.master-sidebar-v2 \.sidebar-mobile-head \.master-brand-v2\{display:flex/);
});

test('troca do autenticador preserva a chave atual até confirmar a nova',()=>{
  const auth=read('backend/src/routes/auth.js');
  assert.match(auth,/\/mfa\/rotate\/start/);
  assert.match(auth,/mfa_pending_secret_enc=\$1/);
  assert.match(auth,/\/mfa\/rotate\/confirm/);
  assert.match(auth,/mfa_secret_enc=mfa_pending_secret_enc/);
  assert.match(auth,/mfa_pending_secret_enc=NULL/);
  assert.match(auth,/papel !== 'super_admin'/);
  assert.match(auth,/O 2FA é obrigatório para o Supermaster/);
});

test('schema de boot prepara segredo pendente do MFA sem shell manual',()=>{
  const server=read('backend/server.js');
  const service=read('backend/src/services/accountSecurity.js');
  assert.match(server,/ensureAccountSecuritySchema/);
  assert.match(service,/ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT/);
});
