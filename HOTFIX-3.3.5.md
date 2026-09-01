# EliteFlow 3.3.5 — Recebimento central das assinaturas

- Pix e cartão das assinaturas Starter, Pro e Premium usam exclusivamente as credenciais da plataforma configuradas pelo Supermaster.
- Credenciais de gateways das barbearias continuam isoladas e servem apenas para pagamentos dos próprios clientes da barbearia.
- Webhook das assinaturas prioriza o segredo Mercado Pago salvo pelo Supermaster; `MP_WEBHOOK_SECRET` permanece apenas como compatibilidade de webhook.
- Em produção, variáveis MP_* antigas não são usadas como recebedor, salvo se `ALLOW_LEGACY_PLATFORM_MP_ENV=true`.
- Troca para outra conta Mercado Pago é bloqueada enquanto existirem assinaturas recorrentes ativas; rotação de token da mesma conta continua permitida.
- Remoção da conta recebedora também é bloqueada enquanto houver recorrências ativas.
