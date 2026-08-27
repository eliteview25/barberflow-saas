# BarberFlow — preparação para IA no WhatsApp

## Estado desta versão
A base está preparada, mas o motor de IA ainda não responde clientes. Isso é intencional para não colocar um agente sem guardrails em produção.

## Arquitetura preparada
Cliente → WhatsApp → webhook BarberFlow → orquestrador de IA → ferramentas controladas → serviços BarberFlow → PostgreSQL.

A IA nunca deve receber uma conexão SQL nem gerar SQL. As ações previstas são uma allowlist:
- consultar_horarios
- criar_agendamento
- reagendar_agendamento
- cancelar_agendamento
- listar_servicos_e_precos
- criar_link_pagamento

## Configuração por barbearia
A tabela `ai_config` guarda apenas preferências operacionais do tenant: nome do assistente, tom, mensagens e quais ações podem ser usadas. A tabela `ai_uso_mensal` está preparada para contabilizar franquia, tokens e custo por tenant.

## Planos
- Starter: R$ 49,90/mês — até 2 profissionais.
- Pro: R$ 89,90/mês — até 5 profissionais. IA prevista como adicional de R$ 59,90/mês quando o billing do add-on for implementado.
- Premium: R$ 169,90/mês — profissionais ilimitados e IA incluída quando a integração for ativada. Franquia planejada: 500 atendimentos/mês.

## Próxima implementação
1. Webhook de mensagens recebidas da Meta.
2. Normalização e vinculação do contato ao tenant correto.
3. Orquestrador LLM com saída estruturada/tool calling.
4. Implementação das ferramentas por serviços internos, sempre com `barbearia_id` do contexto autenticado do webhook.
5. Idempotência de mensagens, limites, retries e handoff humano.
6. Contabilização de uso/custo por barbearia.
7. Billing do add-on de IA no Pro e franquia/excedentes no Premium.
8. Testes de prompt injection, cross-tenant e autorização de ferramentas antes de ativar produção.
