const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const tenant=fs.readFileSync(path.join(__dirname,'..','src','routes','tenant.js'),'utf8');
const common=fs.readFileSync(path.join(root,'frontend','js','common.js'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'frontend','script.js'),'utf8');
const pagamentos=fs.readFileSync(path.join(root,'frontend','js','pagamentos.js'),'utf8');

test('confirmação de Pix manual não exige segundo step-up',()=>{
  const m=tenant.match(/router\.post\('\/pagamentos-pendentes\/:id\/confirmar',[\s\S]*?\}\);/);
  assert.ok(m,'rota de confirmação não encontrada');
  const head=m[0].slice(0,m[0].indexOf('async(req,res)'));
  assert.match(head,/exigirPapel\('dono','gerente','recepcao'\)/);
  assert.match(head,/exigirAssinatura/);
  assert.doesNotMatch(head,/exigirStepUp/);
});

test('aprovação continua auditada e isolada',()=>{
  assert.match(tenant,/pagamento\.pix_manual\.confirmado/);
  assert.match(tenant,/barbeariaId:req\.usuario\.barbearia_id/);
  assert.match(tenant,/confirmedBy:req\.usuario\.id/);
  assert.match(tenant,/whatsapp_enviado/);
});

test('dashboard e pagamentos executam a confirmação diretamente pela API',()=>{
  assert.match(dashboard,/api\(`\/pagamentos-pendentes\/\$\{id\}\/confirmar`,\{method:'POST'\}\)/);
  assert.match(pagamentos,/api\(`\/pagamentos-pendentes\/\$\{id\}\/confirmar`,\{method:'POST'\}\)/);
});

test('step-up geral continua disponível para outras ações sensíveis',()=>{
  assert.match(common,/step_up_required/);
  assert.match(common,/requestStepUp/);
});
