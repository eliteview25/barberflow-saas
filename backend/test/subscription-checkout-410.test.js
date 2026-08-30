const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('tenant importa e usa checkoutUrlAssinatura após criar a assinatura',()=>{
  const t=read('src/routes/tenant.js');
  assert.match(t,/buscarAssinaturaPorReferencia,checkoutUrlAssinatura,obterAssinatura/);
  assert.match(t,/let full=mp,checkoutUrl=checkoutUrlAssinatura\(mp\)/);
  assert.match(t,/checkout_url:checkoutUrl/);
  assert.match(t,/pendente_reconciliacao:true/);
  assert.match(t,/obterAssinatura\(existing\.referencia_externa\)/);
});

test('helper de checkout gera URL oficial a partir do preapproval id quando init_point não vem',()=>{
  const mp=read('src/services/mercadoPago.js');
  assert.match(mp,/subscriptions\/checkout\?preapproval_id=/);
  assert.match(mp,/subscription\?\.init_point\|\|subscription\?\.sandbox_init_point/);
});

test('webhook reconcilia referência com ciclo mensal ou anual',()=>{
  const w=read('src/services/webhookProcessors.js');
  assert.match(w,/\(mensal\|anual\)/);
  assert.match(w,/ciclo_cobranca=COALESCE\(\$8,ciclo_cobranca\)/);
  assert.match(w,/parsed\?\.\[3\]\|\|null/);
  assert.match(w,/checkoutUrlAssinatura\(mp\)/);
});
