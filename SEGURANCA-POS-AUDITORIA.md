# BarberFlow — Pós-auditoria de segurança

Esta versão corrige os achados da primeira auditoria estática defensiva.

## Correções aplicadas

- Webhook WhatsApp valida `X-Hub-Signature-256` com `META_WHATSAPP_APP_SECRET` antes de aceitar o evento.
- Webhook Mercado Pago exige `MP_WEBHOOK_SECRET` em produção e usa validação HMAC.
- Eventos de webhook têm idempotência persistente em `webhook_events`.
- Sessão web migrou de JWT no `localStorage` para cookie `HttpOnly`, `Secure` em produção e proteção CSRF.
- CSP foi habilitada via Helmet; scripts inline não são permitidos.
- Troca/reset de senha incrementa `token_version` e invalida sessões antigas.
- Todos os links de reset anteriores são invalidados ao emitir/usar um novo reset.
- Supermaster exige MFA TOTP e step-up (senha + TOTP) para operações críticas.
- Reservas/agendamentos públicos usam tokens aleatórios de alta entropia; IDs sequenciais não são credenciais públicas.
- Agenda pública usa Turnstile, OTP por e-mail para fluxos sem confirmação automática e limites por telefone.
- Novos cadastros exigem verificação de e-mail antes de iniciar o trial Premium de 7 dias.
- Banco ganhou `NOT NULL`, FKs compostas por tenant e CHECKs de valores/status para reduzir corrupção cross-tenant.
- PDV rejeita quantidade, desconto, preços, estoque e comissões fora de faixas válidas.
- Agendamentos guardam snapshot de valor para preservar histórico financeiro.
- Upload valida assinatura real de PNG/JPEG, dimensões e usa transformação Cloudinary com remoção de metadados.
- Checkout de assinatura usa lock/idempotência e evita criar nova assinatura enquanto outra está pendente/ativa.
- Alteração de plano vinculada ao Mercado Pago reconcilia o valor externo antes de alterar o plano local.
- Status de assinatura Mercado Pago não pode ser sobrescrito manualmente pelo Supermaster; deve vir do provedor.
- Restauração de barbearia reativa apenas usuários desativados pela exclusão e exige reconciliação da assinatura.
- `audit:security` detecta regressões das proteções acima.

## Variáveis obrigatórias em produção

Além do banco/JWT/APP_URL já existentes:

```env
APP_SECRETS_ENCRYPTION_KEY=<48+ chars>
MP_WEBHOOK_SECRET=<segredo do webhook MP>
REQUIRE_TURNSTILE=true
TURNSTILE_SITE_KEY=<site key>
TURNSTILE_SECRET_KEY=<secret key>
RESEND_API_KEY=<chave Resend>
EMAIL_FROM=BarberFlow <no-reply@seudominio.com>
PUBLIC_BOOKING_REQUIRE_OTP=true
```

Se a Cloud API oficial estiver habilitada:

```env
WHATSAPP_ENABLED=true
META_WHATSAPP_APP_SECRET=<App Secret da Meta>
```

## Após deploy

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
npm run audit:deps
```

`audit:deps` precisa de acesso ao registry npm.

## Lockfile

O repositório GitHub já possui `backend/package-lock.json`. Preserve esse arquivo ao aplicar este pacote e use `npm ci` no Build Command do Render. O ZIP não deve ser usado para apagar o lockfile existente do repositório.

## Limite desta revisão

Esta correção é baseada em revisão estática e testes automatizados locais de sintaxe/regressão. O próximo passo obrigatório antes de clientes pagantes é pentest dinâmico autorizado em staging: IDOR/tenant escape, privilege escalation, CSRF/XSS, spoof de webhooks, corrida de reservas, rate limits e uploads.
