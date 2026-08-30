const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const service=fs.readFileSync(path.join(root,'backend/src/services/financeAnalytics.js'),'utf8');
const tenant=fs.readFileSync(path.join(root,'backend/src/routes/tenant.js'),'utf8');
const finance=fs.readFileSync(path.join(root,'frontend/js/financeiro.js'),'utf8');
const financeHtml=fs.readFileSync(path.join(root,'frontend/pages/financeiro.html'),'utf8');
const dash=fs.readFileSync(path.join(root,'frontend/script.js'),'utf8');
const dashHtml=fs.readFileSync(path.join(root,'frontend/index.html'),'utf8');
const reservations=fs.readFileSync(path.join(root,'backend/src/services/reservations.js'),'utf8');

test('analytics financeiro consolida PDV e agendamento sem duplicar venda vinculada',()=>{
  assert.match(service,/FROM vendas v/);
  assert.match(service,/FROM agendamentos a/);
  assert.match(service,/NOT EXISTS\(SELECT 1 FROM vendas v WHERE v\.barbearia_id=a\.barbearia_id AND v\.agendamento_id=a\.id AND v\.status='finalizada'\)/);
  assert.match(service,/financialEntries/);
});

test('financeiro oferece gráfico de Pix e ranking com comissão estimada',()=>{
  assert.match(service,/paymentGroupSql/);
  assert.match(service,/WHEN .* IN \('pix','pix_manual'\) THEN 'pix'/s);
  assert.match(service,/comissao_estimada/);
  assert.match(finance,/pix-highlight/);
  assert.match(finance,/Ranking de barbeiros/);
  assert.match(finance,/comissão estimada/);
});

test('metas financeiras são isoladas por tenant e apenas dono pode editar',()=>{
  assert.match(service,/CREATE TABLE IF NOT EXISTS metas_financeiras/);
  assert.match(service,/barbearia_id INTEGER NOT NULL/);
  assert.match(service,/ux_meta_financeira_barbeiro_mes/);
  assert.match(tenant,/router\.put\('\/financeiro\/metas',exigirPapel\('dono'\)/);
  assert.match(tenant,/saveGoals\(req\.usuario\.barbearia_id/);
  assert.match(finance,/Configurar metas/);
});

test('dashboard premium mostra gráfico real de 7 dias e backend mantém séries completas',()=>{
  for(const id of ['revSemana','dashboardRevenueChart','barberPerformance'])assert.match(dashHtml,new RegExp(`id=\"${id}\"`));
  for(const p of ['diario','semanal','mensal','anual'])assert.ok(service.includes(`series(barbeariaId,'${p}')`));
  assert.match(tenant,/router\.get\('\/financeiro\/dashboard'/);assert.match(service,/barbeiros/);assert.match(dash,/renderRevenueChart/);assert.match(dash,/renderBarberPerformance/);
});

test('Mercado Pago passa a registrar Pix ou cartão quando o provedor informa o método',()=>{
  assert.match(reservations,/function paymentForm\(payment\)/);
  assert.match(reservations,/method==='pix'/);
  assert.match(reservations,/credit_card','debit_card','prepaid_card/);
  assert.match(reservations,/forma_pagamento,status_pagamento/);
});

test('tela financeira lista origem e forma de pagamento das receitas',()=>{
  assert.match(financeHtml,/>Origem</);
  assert.match(financeHtml,/>Pagamento</);
  assert.match(finance,/originLabel/);
  assert.match(finance,/methodLabel/);
});
