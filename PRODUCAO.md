# BarberFlow 4.3.0 — produção segura

## Implantação

Use `backend` como **Root Directory**.

- Build Command: `npm ci`
- Start Command: `npm start`
- Nunca use `npm install` nem ignore o lockfile no servidor.

Antes de trocar a versão, gere um backup remoto válido. Depois execute:

```bash
npm ci
npm run audit:deps
npm run audit:config
npm run migrate
npm run verify
npm run qa
npm run audit:pilot
```

A migração é idempotente. A 4.3.0 altera os requisitos de sessão; usuários existentes poderão precisar entrar novamente.

Depois que a nova instância estiver iniciada e acessível por `APP_URL`, execute de um runner autorizado:

```bash
npm run smoke:security
```

## Variáveis obrigatórias

```env
NODE_ENV=production
APP_URL=https://seu-dominio.example

DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

JWT_SECRET=<48+ caracteres aleatórios>
APP_SECRETS_ENCRYPTION_KEY=<48+ caracteres aleatórios>
BOOKING_OTP_PEPPER=<48+ caracteres aleatórios>
LOGIN_THROTTLE_SECRET=<48+ caracteres aleatórios>
CRON_SECRET=<48+ caracteres aleatórios>
MP_WEBHOOK_TENANT_SECRET=<48+ caracteres aleatórios>
BILLING_WEBHOOK_SECRET=<48+ caracteres aleatórios>
BACKUP_ENCRYPTION_KEY=<48+ caracteres aleatórios>

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
REQUIRE_TURNSTILE=true
PUBLIC_BOOKING_REQUIRE_OTP=true

RESEND_API_KEY=
EMAIL_FROM=BarberFlow <no-reply@seu-dominio.example>

BACKUP_UPLOAD_URL=https://storage-externo.example/upload
```

Todos os oito segredos de 48+ caracteres devem ser diferentes. Gere-os com um gerenciador de segredos; não os envie por chat, não os grave no Git e não reutilize chaves entre produção, staging e desenvolvimento.

Quando o PostgreSQL exigir CA privada, configure `DB_SSL_CA`. Mantenha `DB_SSL_REJECT_UNAUTHORIZED=true`.

## Serviços opcionais

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Mercado Pago OAuth: `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI`, `MP_TOKEN_ENCRYPTION_KEY`.
- Evolution: `EVOLUTION_API_URL` HTTPS e `EVOLUTION_API_KEY`.
- Meta: `WHATSAPP_ENABLED=true`, `META_WHATSAPP_APP_SECRET` e a versão Graph suportada.
- IA: `OPENAI_API_KEY` e `AI_MODEL`; sem chave, o fluxo clássico continua ativo.
- NFS-e: `NFSE_API_URL` HTTPS e `NFSE_API_TOKEN`.

Se habilitar OAuth Mercado Pago, use uma `MP_TOKEN_ENCRYPTION_KEY` exclusiva de 48+ caracteres e mantenha o redirect na mesma origem de `APP_URL`.

## Webhook de cobrança da plataforma

O emissor deve enviar:

- `x-webhook-timestamp`: Unix timestamp atual;
- `x-signature`: `sha256=` + HMAC-SHA256 de `timestamp + "." + corpo_bruto` com `BILLING_WEBHOOK_SECRET`;
- chave/evento idempotente conforme o endpoint.

Requisições antigas, sem assinatura válida ou repetidas são rejeitadas/reconciliadas sem duplicar cobrança.

## Controles operacionais obrigatórios

- Exija MFA no Supermaster e prefira MFA também para donos.
- Coloque a aplicação atrás de CDN/WAF e rate limit distribuído.
- Restrinja o banco por rede, use usuário sem privilégios administrativos e habilite logs de auditoria do provedor.
- Monitore `/api/health/ready`, erros 5xx, falhas de login, webhooks e backups.
- Agende `npm run maintenance` e `npm run backup`.
- Teste restauração em ambiente separado; arquivo criado apenas no disco do serviço não é backup.
- Rode `npm run audit:deps` em cada build e atualização emergencial.
- Rotacione imediatamente qualquer segredo exposto em log, screenshot ou incidente.

## Pós-deploy

Teste com contas separadas de dono, gerente, recepção, barbeiro e Supermaster. Confirme isolamento entre duas barbearias, verificação de e-mail, MFA/step-up, upload, notificações, pagamentos e rejeição de webhooks inválidos.
