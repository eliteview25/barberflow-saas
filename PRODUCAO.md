# BarberFlow — Produção segura

## Render

Use `backend` como Root Directory.

**Build Command**:

```bash
npm ci
```

**Start Command**:

```bash
npm start
```

Na primeira aplicação da Segurança V2, rode `npm install` localmente para atualizar o lockfile e remover Multer dele. Commit o novo `backend/package-lock.json`; a partir daí preserve-o versionado e use `npm ci` no Render.

## Variáveis mínimas

```env
NODE_ENV=production
APP_URL=https://SEU_DOMINIO
JWT_SECRET=<48+ chars aleatórios>
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
APP_SECRETS_ENCRYPTION_KEY=<48+ chars>
MP_WEBHOOK_SECRET=
MP_WEBHOOK_TENANT_SECRET=<48+ chars aleatórios>
BOOKING_OTP_PEPPER=<48+ chars aleatórios>
CRON_SECRET=<48+ chars aleatórios>
REQUIRE_TURNSTILE=true
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM=BarberFlow <no-reply@seudominio.com>
PUBLIC_BOOKING_REQUIRE_OTP=true
ALLOW_PUBLIC_REGISTRATION=true
```

Quando usar WhatsApp Cloud API:

```env
WHATSAPP_ENABLED=true
META_WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=v23.0
```

Outras integrações (Mercado Pago OAuth, Cloudinary, Evolution API e Cron) continuam usando as variáveis já documentadas no `.env.example`.

## Deploy com alteração de banco

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
```

## Segurança operacional

- Supermaster: MFA obrigatório. Guarde o autenticador/segredo de recuperação em local seguro.
- Troque qualquer segredo que tenha aparecido em conversa, log ou screenshot.
- Webhooks Mercado Pago e Meta devem rejeitar assinatura inválida.
- Backup automático do PostgreSQL + teste periódico de restauração.
- Uptime monitor em `/api/health/ready`.
- Rode `npm run maintenance` periodicamente.
- Rode `npm run audit:deps` em CI/deploy de segurança.
- Não desative Turnstile/OTP em produção sem avaliação de abuso da agenda.
