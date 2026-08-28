# BarberFlow 2.2 — Pagamentos e gateways

## O que está pronto

A navegação do BarberFlow possui uma área dedicada **Pagamentos** para Dono e Gerente.

A tela separa duas responsabilidades:

1. **Como cobrar no agendamento** — cobrança antecipada, sinal, Pix, cartão, dinheiro e Pix manual.
2. **Contas de pagamento conectadas** — status e conexão de gateways por barbearia.

## Gateways

### Mercado Pago — processamento ativo

É o gateway que já possui driver de pagamento completo no BarberFlow.

- Conexão da conta da própria barbearia por OAuth.
- Pix e cartão no agendamento.
- Confirmação automática por webhook.
- Tokens da conta conectada armazenados criptografados no servidor.
- O dono pode conectar, desconectar e reconectar sua conta.

Variáveis da plataforma BarberFlow:

```env
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/mercadopago/callback
```

A criptografia usa `APP_SECRETS_ENCRYPTION_KEY`; `MP_TOKEN_ENCRYPTION_KEY` continua aceito pela integração legada.

### PagBank — conexão preparada

O fluxo PagBank Connect está preparado para autorizar a conta do vendedor e guardar access/refresh token criptografados. O driver que cria cobranças PagBank ainda não é selecionável no agendamento nesta versão.

```env
PAGBANK_ENV=production
PAGBANK_CLIENT_ID=
PAGBANK_CLIENT_SECRET=
PAGBANK_PLATFORM_TOKEN=
PAGBANK_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/pagamentos/oauth/pagbank/callback
```

### Asaas — conexão preparada

O dono informa a API Key da própria conta na tela Pagamentos. O BarberFlow valida a credencial em uma chamada somente de leitura e armazena a chave criptografada. O driver de cobrança Asaas entra em uma etapa posterior.

Nenhuma API Key Asaas deve ser colocada no `.env` global do BarberFlow para representar uma barbearia.

### Pagar.me — conexão preparada

O dono informa Secret Key e, opcionalmente, Public Key da própria conta. A Secret Key é validada em uma chamada somente de leitura e armazenada criptografada. O driver de cobrança Pagar.me entra em uma etapa posterior.

### Stripe — conexão preparada

Existe scaffold de Stripe Connect para conexão de conta Standard. Como a Stripe recomenda Connect Onboarding para novas plataformas, o fluxo deve ser revisto/migrado para o modelo recomendado antes de ativar o driver de pagamentos Stripe em produção.

```env
STRIPE_SECRET_KEY=
STRIPE_CONNECT_CLIENT_ID=
STRIPE_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/pagamentos/oauth/stripe/callback
```

## Segurança

- Conectar/desconectar gateway: somente `dono`.
- Configuração de cobrança: `dono` ou `gerente`, respeitando o recurso `pagamentos_online`.
- Starter vê a área como upsell, mas o backend bloqueia conexão.
- Segredos nunca são devolvidos pela API de status.
- Segredos de gateways manuais e tokens OAuth são criptografados no banco.
- OAuth usa `state` de uso único, expira em 10 minutos e é separado por provedor.
- Toda consulta de integração é filtrada por `barbearia_id`.

## Importante

**Conectado** não significa **driver de cobrança ativo**.

Nesta versão:

- Mercado Pago: conexão + processamento de cobranças.
- PagBank: conexão preparada; processamento será implementado em driver próprio.
- Asaas: conexão/validação preparada; processamento será implementado em driver próprio.
- Pagar.me: conexão/validação preparada; processamento será implementado em driver próprio.
- Stripe: conexão em preparação; onboarding e driver serão finalizados antes de produção.

Essa separação evita prometer ao cliente uma forma de pagamento que ainda não está processando transações no BarberFlow.
