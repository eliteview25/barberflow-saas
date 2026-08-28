# BarberFlow 2.4 — Financeiro e Dashboard

## O que mudou

- Financeiro consolida vendas finalizadas do PDV e atendimentos concluídos sem venda vinculada, evitando dupla contagem.
- Gráfico mensal de faturamento.
- Gráfico por forma de pagamento, com Pix destacado.
- Novos pagamentos Mercado Pago passam a registrar Pix ou cartão quando o provedor informa o método; históricos genéricos permanecem como Mercado Pago.
- Ranking mensal de barbeiros por faturamento gerado, incluindo comissão estimada.
- Metas mensais da barbearia e metas individuais por barbeiro. Somente o dono edita; gerente pode acompanhar.
- Dashboard com faturamento de hoje, semana atual, mês atual e ano atual.
- Gráfico alternável no Dashboard: diário, semanal, mensal e anual.

## Regra de faturamento

Quando existe uma venda finalizada no PDV vinculada a um agendamento, a venda é a fonte da receita. O agendamento não é somado de novo. Quando o atendimento foi concluído sem venda finalizada vinculada, o valor final do agendamento entra no faturamento.

## Banco

A tabela `metas_financeiras` e seus índices são criados automaticamente no boot pelo `ensureFinanceAnalyticsSchema()`. A migração manual também contém a mesma estrutura para instalações que preferirem executar `npm run migrate` em manutenção planejada.
