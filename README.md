# EliteFlow: Gestão de Barbearia 4.5.5

SaaS multiempresa para gestão de barbearias com agenda, clientes, equipe, serviços, página pública, pagamentos, PDV/estoque, CRM, marketing, automações, WhatsApp, financeiro, Supermaster e planos Starter/Pro/Premium.

## Estrutura

- `backend/` — API Node.js/Express, serviços, segurança, jobs e testes.
- `frontend/` — painel, páginas públicas, autenticação e documentos legais.
- `database/` — schema e dados/migrações de apoio.

## Desenvolvimento local

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run migrate
npm start
```

## Validação antes do deploy

Dentro de `backend/`:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
npm run smoke:security
```

Use `backend` como diretório raiz do serviço e preserve `backend/package-lock.json`. Em produção, prefira `npm ci`.

## Trial e planos

Novas contas entram como `trial_pendente`. Após a verificação do e-mail, o trial Premium é ativado por 7 dias.

- Starter — R$ 69,90/mês ou R$ 699/ano — até 2 profissionais.
- Pro — R$ 119,90/mês ou R$ 1.199/ano — até 5 profissionais.
- Premium — R$ 199,90/mês ou R$ 1.999/ano — até 10 profissionais.
- Enterprise — contratação comercial para operações acima dos limites do Premium.

O anual corresponde a 10 mensalidades e libera 12 meses de uso.

## Segurança

A aplicação mantém isolamento multi-tenant, sessão por cookie HttpOnly, CSRF, CSP, MFA/TOTP, step-up para ações sensíveis, rate limit, validação de webhooks, idempotência financeira, auditoria, proteção de uploads e validações de autorização por papel e tenant.

Nunca versione `.env`, credenciais, backups, dumps, logs ou arquivos de produção.

## LGPD e documentos legais

A versão 4.5.5 inclui revisão de privacidade e conformidade. Antes do lançamento comercial, configure os dados jurídicos reais da operação no ambiente.

Documentos atuais mantidos no repositório:

- `ELITEFLOW-4.5.5.md` — resumo da versão atual.
- `LEGAL-README.md` — configuração e publicação das páginas legais.
- `LGPD-COMPLIANCE-4.5.5.md` — matriz de conformidade.
- `MAPA-DADOS-LGPD.md` — mapa resumido de dados pessoais.
- `RETENCAO-DADOS-LGPD.md` — política técnica de retenção.
- `PLANO-INCIDENTES-LGPD.md` — resposta a incidentes com dados pessoais.
- `AUDITORIA-SEGURANCA-V2.md` — auditoria técnica consolidada.
- `PRE-DEPLOY-SECURITY.md` — checklist de segurança.
- `BACKUP-PRODUCAO.md` — política operacional de backup.
- `PRODUCAO.md` — implantação em produção.
- `QA-PILOTO.md` — checklist de QA/piloto.
- `CHECKOUT-PLANOS.md` — fluxo atual de assinatura e checkout.

As páginas públicas legais ficam em `frontend/`: Termos, Privacidade, LGPD, Cancelamento, Cookies, DPA e Terceiros.

## Git limpo

O `.gitignore` da raiz impede a inclusão acidental de dependências, segredos, ZIPs de release, hashes, logs, backups e arquivos temporários.

O histórico detalhado das versões anteriores deve permanecer no próprio histórico de commits/tags do Git, e não em dezenas de arquivos `.md` na raiz do projeto.
