# EliteFlow: Gestão de Barbearia 4.5.7

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

## Atendimento do WhatsApp no Premium

Cada barbearia Premium escolhe, em **Automações**, quais canais atenderão novas conversas:

- **Fluxo padrão** — menus e etapas configuradas, sem consumo de IA.
- **Somente IA** — interpretação de linguagem natural com ações validadas pelo servidor.
- **IA + fluxo** — IA para mensagens livres e fluxo padrão para seus gatilhos, como “oi”.

O fluxo padrão vem ligado em instalações novas. Configurações antigas com IA ativa são migradas automaticamente para **IA + fluxo**; clientes fora do Premium permanecem no fluxo padrão.

## Segurança

A aplicação mantém isolamento multi-tenant, sessão por cookie HttpOnly, CSRF, CSP, MFA/TOTP, step-up para ações sensíveis, rate limit, validação de webhooks, idempotência financeira, auditoria, proteção de uploads e validações de autorização por papel e tenant.

O dono pode solicitar a exclusão da própria barbearia em **Configurações > Segurança**. A ação exige confirmação de identidade, interrompe a recorrência, revoga as sessões e inicia retenção de 30 dias. Durante esse prazo, a conta pode ser restaurada por um link individual de uso único enviado por e-mail; a assinatura permanece cancelada até reativação explícita.

Nunca versione `.env`, credenciais, backups, dumps, logs ou arquivos de produção.

## LGPD e documentos legais

A revisão de privacidade e conformidade da versão 4.5.5 continua válida na 4.5.7. Antes do lançamento comercial, configure os dados jurídicos reais da operação no ambiente.

Documentos atuais mantidos no repositório:

- `ALTERACOES-4.5.7.md` — resumo da versão atual.
- `ALTERACOES-4.5.6.md` — resumo da versão anterior.
- `ELITEFLOW-4.5.5.md` — resumo consolidado da versão anterior.
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
