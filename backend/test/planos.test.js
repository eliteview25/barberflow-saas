const test=require('node:test');const assert=require('node:assert/strict');
const {planoEfetivo,recursosDoPlano,trialAtivo}=require('../src/services/planCatalog');
test('Starter contém somente núcleo esperado',()=>{const r=recursosDoPlano('starter');for(const x of ['agenda','clientes','barbeiros','servicos'])assert.ok(r.includes(x));assert.ok(!r.includes('equipe'));});
test('Pro inclui equipe e financeiro básico',()=>{const r=recursosDoPlano('pro');assert.ok(r.includes('equipe'));assert.ok(r.includes('financeiro_basico'));assert.ok(!r.includes('automacoes'));});
test('Premium inclui automações e gestão avançada',()=>{const r=recursosDoPlano('premium');assert.ok(r.includes('automacoes'));assert.ok(r.includes('pdv_estoque'));assert.ok(r.includes('exportacao_dados'));});
test('Trial ativo usa Premium',()=>{const fim=new Date(Date.now()+86400000).toISOString().slice(0,10);const a={status:'trial',plano:'starter',fim_trial:fim};assert.equal(trialAtivo(a),true);assert.equal(planoEfetivo(a),'premium');});
