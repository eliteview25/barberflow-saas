const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

test('boot libera contas legadas presas em trial_pendente sem reativar canceladas',()=>{
  assert.match(server,/corrigirCompatibilidadeLegada/);
  assert.match(server,/status='trial_pendente'/);
  assert.match(server,/status='trial'/);
  assert.match(server,/email_verificado=true/);
  assert.doesNotMatch(server,/status\s+IN\s*\([^)]*cancelada[^)]*\).*SET\s+status='trial'/is);
});

test('correção legada roda antes de abrir a porta HTTP',()=>{
  const fix=server.indexOf('await corrigirCompatibilidadeLegada()');
  const listen=server.indexOf('app.listen');
  assert.ok(fix>=0 && listen>=0 && fix<listen);
});
