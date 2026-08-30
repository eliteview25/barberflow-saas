const test=require('node:test');const assert=require('node:assert/strict');
const {planoEfetivo,recursosDoPlano,trialAtivo}=require('../src/services/planCatalog');
test('Starter contém núcleo operacional completo',()=>{const r=recursosDoPlano('starter');for(const x of ['agenda','clientes','barbeiros','servicos','pagina_publica_simples','financeiro_basico','pdv_estoque','comandas','comissoes'])assert.ok(r.includes(x));assert.ok(!r.includes('automacoes'));});
test('Pro inclui equipe, WhatsApp e relacionamento',()=>{const r=recursosDoPlano('pro');for(const x of ['equipe','automacoes','whatsapp','crm_avancado','fidelidade','clube_assinaturas','marketing'])assert.ok(r.includes(x));assert.ok(!r.includes('ia_whatsapp'));});
test('Premium inclui IA, fiscal, BI e exportação',()=>{const r=recursosDoPlano('premium');for(const x of ['ia_whatsapp','fiscal_nfse','bi_avancado','exportacao_dados'])assert.ok(r.includes(x));});
test('Trial ativo usa Premium',()=>{const fim=new Date(Date.now()+86400000).toISOString().slice(0,10);const a={status:'trial',plano:'starter',fim_trial:fim};assert.equal(trialAtivo(a),true);assert.equal(planoEfetivo(a),'premium');});
