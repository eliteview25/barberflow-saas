# Checklist de produção

O núcleo SaaS está implementado. Antes de cobrar clientes reais:

1. Hospedar PostgreSQL com backup automático.
2. Configurar `NODE_ENV=production`, `JWT_SECRET` forte e HTTPS.
3. Restringir CORS ao domínio real (o código está aberto no modo local).
4. Conectar um provedor de cobrança ao webhook `POST /api/webhooks/billing` usando `x-barberflow-secret`.
5. Conectar e-mail para entregar os tokens de recuperação de senha.
6. Opcional: configurar `AUTOMATION_WEBHOOK_URL` para n8n/Make/WhatsApp. Eventos de criação e mudança de status já são enviados.
7. Criar Termos de Uso, Política de Privacidade e rotina de atendimento LGPD.
8. Adicionar logs/monitoramento (ex.: Sentry/OpenTelemetry) e alertas de indisponibilidade.
9. Fazer testes de carga e um piloto com 1–3 barbearias antes de marketing amplo.

## Cobrança

A aplicação já bloqueia recursos operacionais quando o trial expira ou a assinatura deixa de estar `ativa`. O webhook genérico de cobrança aceita estados `trial`, `ativa`, `inadimplente` e `cancelada`. Ele deve ser chamado por uma integração segura do seu provedor (Mercado Pago/Stripe/etc.).

## Automação/WhatsApp

Defina `AUTOMATION_WEBHOOK_URL` e `AUTOMATION_WEBHOOK_SECRET`. O BarberFlow enviará eventos JSON para sua automação. É uma forma simples de conectar n8n/Make e, a partir deles, o provedor oficial de WhatsApp.

## Cobrança recorrente - Mercado Pago

O BarberFlow usa a API de Assinaturas (`/preapproval`) do Mercado Pago.

Variáveis:

```env
MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN
MP_WEBHOOK_SECRET=SUA_CHAVE_SECRETA_DE_WEBHOOK
PLAN_STARTER_PRICE=39.90
PLAN_PRO_PRICE=69.90
PLAN_PREMIUM_PRICE=119.90
APP_URL=https://seu-dominio.com
```

Webhook público:

```text
POST https://seu-dominio.com/api/webhooks/mercadopago
```

O webhook trata `subscription_preapproval` e `subscription_authorized_payment`. Em produção, mantenha `MP_WEBHOOK_SECRET` configurado para validar `x-signature`.

Fluxo: Dono > Assinatura > escolher plano > checkout Mercado Pago > retorno ao BarberFlow > webhook/sincronização > assinatura ativa.


## Mercado Pago OAuth por barbearia

1. Crie/edite a aplicação do BarberFlow em Mercado Pago Developers.
2. Cadastre como Redirect URL: `https://SEU_DOMINIO/api/mercadopago/callback`.
3. Adicione `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` e `MP_TOKEN_ENCRYPTION_KEY` no Environment do Render.
4. Faça Save and Deploy.
5. Rode `npm run migrate` no Shell.
6. Entre como dono da barbearia > Configurações > Recebimentos > Conectar Mercado Pago.

Nunca salve Access Tokens de vendedores em texto puro e nunca envie `MP_CLIENT_SECRET` ao frontend.
