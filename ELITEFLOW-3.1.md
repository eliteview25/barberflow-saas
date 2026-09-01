# EliteFlow 3.1 — UI 2.0 e acompanhamento do cliente

## Interface
- Agenda diária em grade por profissional no desktop e cartões no mobile.
- Status com leitura visual rápida e resumo do dia.
- Ação de WhatsApp ao lado do cliente na agenda e nos próximos atendimentos.
- Dashboard focado em agendamentos, receita prevista, ticket médio e ocupação.
- Sidebar com ícones SVG consistentes, busca, agrupamento progressivo e ação rápida.
- Clientes em cards, com métricas de CRM quando o plano possui CRM avançado.
- Tabelas, cards, botões e hierarquia visual refinados globalmente.

## Acompanhamento de agendamento
- Cada agendamento possui `tracking_code` amigável, além do `public_token` seguro legado.
- O código amigável não autoriza sozinho: a página pública exige código + WhatsApp do cliente.
- A consulta pública permite acompanhar status, cancelar e reagendar quando as regras permitirem.
- Na confirmação, o WhatsApp envia código e link direto para acompanhamento.
- No WhatsApp, o cliente pode enviar `ACOMPANHAR` ou o código para consultar os próximos horários.
- Rotas de acompanhamento têm rate limit dedicado.

## Segurança
O token interno de alta entropia continua preservado para compatibilidade. O novo código de acompanhamento é um identificador de UX combinado com a verificação do telefone e rate limit, não uma substituição do segredo interno.
