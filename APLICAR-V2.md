# Aplicar BarberFlow Segurança V2

## 1. Substitua/mescle os arquivos da V2 no seu projeto

Não apague o seu `.env` e não copie segredos para o Git.

## 2. Atualize dependências e o lockfile

No PowerShell, dentro do projeto:

```powershell
cd backend
npm install
npm audit --omit=dev --audit-level=high
npm test
npm run audit:security
npm run check
cd ..
```

`npm install` é obrigatório nesta atualização porque Multer foi removido do `package.json`; isso atualiza o `package-lock.json` real do seu repositório.

## 3. Versione

```powershell
git status
git add .
git commit -m "Seguranca V2 e integridade financeira"
git pull --rebase origin main
git push origin main
```

Não use `git push --force`.

## 4. Render

Depois que o deploy mais recente estiver **Live**, no Shell do serviço (Root Directory `backend`):

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
npm run maintenance
```

Depois rode contra a URL de produção/staging:

```bash
npm run smoke:security
```

## 5. Variáveis críticas

Consulte `backend/.env.example`. Em produção, revise especialmente:

- `JWT_SECRET`
- `APP_URL`
- `APP_SECRETS_ENCRYPTION_KEY`
- `BOOKING_OTP_PEPPER`
- `CRON_SECRET`
- `MP_WEBHOOK_SECRET`
- `MP_WEBHOOK_TENANT_SECRET`
- `MP_TOKEN_ENCRYPTION_KEY`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `META_WHATSAPP_APP_SECRET` quando WhatsApp Cloud estiver ativo.

Segredos diferentes devem ter valores diferentes. Não reutilize o JWT secret como chave de outra integração.

## 6. Build do Render

Depois que o novo `package-lock.json` estiver commitado, mantenha:

```bash
npm ci
```

como Build Command e `npm start` como Start Command.
