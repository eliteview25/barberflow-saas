const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('dono solicita exclusão com confirmação explícita e step-up',()=>{
  const route=read('backend/src/routes/tenant.js');
  assert.match(route,/router\.delete\('\/conta\/barbearia',exigirPapel\('dono'\),exigirStepUp/);
  assert.match(route,/confirmacao!=='EXCLUIR'/);
  assert.match(route,/ciente!==true/);
  assert.match(route,/atualizarStatusAssinatura\(pre\.referencia_externa,'canceled'\)/);
  assert.match(route,/INTERVAL '30 days'/);
  assert.match(route,/token_version=COALESCE\(token_version,0\)\+1/);
});

test('recuperação usa token hash, expiração, uso único e não reativa assinatura',()=>{
  const auth=read('backend/src/routes/auth.js');
  const email=read('backend/src/services/email.js');
  const life=read('backend/src/services/tenantLifecycle.js');
  assert.match(auth,/router\.post\('\/restaurar-barbearia'/);
  assert.match(auth,/sha256\(token\)/);
  assert.match(auth,/t\.usado_em/);
  assert.match(auth,/UPDATE tenant_deletion_tokens SET usado_em=NOW\(\)/);
  assert.match(auth,/assinatura_reativacao_necessaria:true/);
  assert.match(email,/restaurar-conta\.html\?token=/);
  assert.match(life,/tenant_deletion_tokens/);
});

test('restauração pública exige clique e a zona de risco fica restrita ao dono',()=>{
  const html=read('frontend/pages/configuracoes.html');
  const js=read('frontend/js/configuracoes.js');
  const restore=read('frontend/restaurar-conta.html');
  const restoreJs=read('frontend/js/restaurar-conta.js');
  assert.match(html,/id="tenantDangerZone"/);
  assert.match(html,/id="tenantDeleteConfirm"/);
  assert.match(js,/user\.papel==='dono'/);
  assert.match(js,/api\('\/conta\/barbearia'/);
  assert.match(restore,/id="restoreAccountButton"/);
  assert.match(restoreJs,/button\.addEventListener\('click'/);
  assert.match(restoreJs,/restaurar-barbearia/);
});

test('app protege o endpoint público de restauração com limite sensível',()=>{
  const app=read('backend/src/app.js');
  assert.match(app,/app\.use\('\/api\/auth\/restaurar-barbearia',sensitive\)/);
});
