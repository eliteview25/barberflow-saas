const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const auth=fs.readFileSync(path.join(root,'backend/src/routes/auth.js'),'utf8');
const app=fs.readFileSync(path.join(root,'backend/src/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'frontend/pages/configuracoes.html'),'utf8');
const js=fs.readFileSync(path.join(root,'frontend/js/configuracoes.js'),'utf8');
const login=fs.readFileSync(path.join(root,'frontend/js/login.js'),'utf8');
const {generateSecret,verifyTotp}=require('../src/utils/totp');

function currentTotp(secret){
  const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const crypto=require('node:crypto');
  let bits='';for(const c of secret)bits+=ALPH.indexOf(c).toString(2).padStart(5,'0');
  const arr=[];for(let i=0;i+8<=bits.length;i+=8)arr.push(parseInt(bits.slice(i,i+8),2));
  const key=Buffer.from(arr),counter=Math.floor(Date.now()/30000),buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));
  const h=crypto.createHmac('sha1',key).update(buf).digest(),off=h[h.length-1]&15,n=(h.readUInt32BE(off)&0x7fffffff)%1000000;
  return String(n).padStart(6,'0');
}

test('TOTP do BarberFlow gera segredo e valida código atual',()=>{
  const secret=generateSecret();
  assert.match(secret,/^[A-Z2-7]+$/);
  assert.equal(verifyTotp(secret,currentTotp(secret)),true);
  assert.equal(verifyTotp(secret,'000000',0),currentTotp(secret)==='000000');
});

test('login exige MFA para qualquer usuário que tenha 2FA ativo',()=>{
  assert.match(auth,/if \(usuario\.mfa_enabled\)/);
  assert.match(auth,/mfa_required:\s*true/);
  assert.match(login,/código de 6 dígitos do seu aplicativo autenticador/i);
});

test('configurações oferecem troca de senha com revogação de outras sessões',()=>{
  assert.match(auth,/['"]\/change-password['"]/);
  assert.match(auth,/bcrypt\.compare\(boundedPassword\(senhaAtual\), usuario\.senha_hash\)/);
  assert.match(auth,/strongPassword\(novaSenha\)/);
  assert.match(auth,/token_version=COALESCE\(token_version,0\)\+1/);
  assert.match(html,/id="senhaAtual"/);
  assert.match(html,/id="novaSenha"/);
  assert.match(js,/\/auth\/change-password/);
});

test('2FA opcional usa segredo criptografado e confirmação TOTP',()=>{
  assert.match(auth,/['"]\/mfa\/enroll['"]/);
  assert.match(auth,/encrypt\(secret\)/);
  assert.match(auth,/['"]\/mfa\/enable['"]/);
  assert.match(auth,/verifyAndConsumeTotp\(req\.usuario\.id,secret,code\)/);
  assert.match(auth,/['"]\/mfa\/disable['"]/);
  assert.match(auth,/mfa_secret_enc=NULL/);
});

test('interface 2FA é agnóstica de aplicativo e não persiste segredo no navegador',()=>{
  for(const appName of ['Google Authenticator','Microsoft Authenticator','Authy','1Password','Bitwarden'])assert.match(html,new RegExp(appName));
  assert.match(html,/Abrir no aplicativo autenticador/);
  assert.match(js,/mfaRawSecret/);
  assert.doesNotMatch(js,/localStorage\.setItem\([^\n]*mfa/i);
  assert.doesNotMatch(js,/sessionStorage\.setItem\([^\n]*mfa/i);
});

test('rotas sensíveis de senha e MFA recebem rate limit dedicado',()=>{
  assert.match(app,/app\.use\('\/api\/auth\/mfa',sensitive\)/);
  assert.match(app,/app\.use\('\/api\/auth\/change-password',sensitive\)/);
});
