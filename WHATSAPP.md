# WhatsApp no BarberFlow

O BarberFlow usa a WhatsApp Business Platform / Cloud API. A barbearia Premium conecta `Phone Number ID` e um Access Token na área **Automações**. O token é criptografado antes de ir ao PostgreSQL.

## Webhook
Cadastre na aplicação Meta:
- Callback URL: `https://SEU_DOMINIO/api/whatsapp/webhook`
- Verify token: o mesmo valor de `META_WHATSAPP_VERIFY_TOKEN` no Render.

Assine o evento de mensagens da conta/número correspondente.

## Agendamento conversacional
O cliente envia `oi` e o bot guia por serviço → barbeiro → data → horário → nome → forma de pagamento. A conclusão usa o mesmo endpoint público do BarberFlow, portanto Mercado Pago, Pix manual e dinheiro seguem as regras da barbearia.

## Lembretes
Mensagens iniciadas pela empresa fora da janela de atendimento exigem templates aprovados. Em **Automações**, informe os nomes dos templates. O BarberFlow envia 5 parâmetros no corpo, nesta ordem:
1. nome do cliente
2. serviço
3. barbeiro
4. data
5. horário

Configure um Cron Job para chamar `POST /api/cron/automacoes/processar` com header `x-barberflow-cron: <CRON_SECRET>` em intervalo adequado (ex.: a cada 10–15 minutos).
