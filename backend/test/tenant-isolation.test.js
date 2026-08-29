const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function source(name){return fs.readFileSync(path.join(__dirname,'..','src','routes',name),'utf8')}

test('APIs CRUD principais aplicam escopo de barbearia',()=>{
  const checks={
    'clientes.js':[/clientes WHERE barbearia_id=\$1/,/WHERE id=\$7 AND barbearia_id=\$8/,/WHERE id=\$1 AND barbearia_id=\$2/],
    'barbeiros.js':[/barbeiros WHERE barbearia_id=\$1/,/WHERE id=\$4 AND barbearia_id=\$5/,/barbeiro_id=\$1 AND barbearia_id=\$2/],
    'servicos.js':[/servicos WHERE barbearia_id=\$1/,/WHERE id=\$5 AND barbearia_id=\$6/,/WHERE id=\$1 AND barbearia_id=\$2/],
    'agendamentos.js':[/a\.barbearia_id=\$1/,/WHERE id=\$1 AND barbearia_id=\$2 FOR UPDATE/,/WHERE id=\$3 AND barbearia_id=\$4/]
  };
  for(const [file,patterns] of Object.entries(checks)){
    const s=source(file);
    for(const pattern of patterns)assert.match(s,pattern,`${file} sem predicado tenant esperado: ${pattern}`);
  }
});

test('configurações e pagamentos operacionais exigem assinatura ativa',()=>{
  const s=source('tenant.js');
  assert.match(s,/router\.get\('\/configuracoes',exigirPapel\('dono','gerente'\),exigirAssinatura/);
  assert.match(s,/router\.put\('\/configuracoes',exigirPapel\('dono','gerente'\),exigirAssinatura/);
  assert.match(s,/router\.get\('\/pagamentos-pendentes',exigirPapel\('dono','gerente','recepcao'\),exigirAssinatura/);
  assert.match(s,/router\.post\('\/pagamentos-pendentes\/:id\/confirmar',exigirPapel\('dono','gerente','recepcao'\),exigirAssinatura/);
});

test('rotas operacionais principais têm gate de assinatura ou recurso',()=>{
  for(const file of ['clientes.js','barbeiros.js','servicos.js','agendamentos.js','operacao.js']){
    const s=source(file);
    assert.match(s,/router\.use\(autenticar,exigirAssinatura\)/,`${file} sem gate global de assinatura`);
  }
  for(const file of ['uploads.js','mercadoPagoConnect.js','whatsapp.js']){
    const s=source(file);
    assert.match(s,/exigirRecurso\(/,`${file} sem gate de recurso/assinatura`);
  }
});
