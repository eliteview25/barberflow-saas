# BarberFlow SaaS — Segurança V2 / Auditoria Profunda

SaaS multiempresa para gestão de barbearias com agenda, clientes, equipe, serviços, página pública, pagamentos, PDV/estoque, CRM, fidelidade, automações, Supermaster e planos Starter/Pro/Premium.

## Segurança desta versão

A V2 passou por uma revisão estática aprofundada de segurança, isolamento multi-tenant, concorrência, integridade financeira e confiabilidade de webhooks.

Leia **`AUDITORIA-SEGURANCA-V2.md`** e **`APLICAR-V2.md`** antes do deploy.

## Local

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run migrate
npm start
```

## Produção

Antes do primeiro deploy desta V2, rode `npm install` localmente dentro de `backend` e versione o `package-lock.json` atualizado. Depois, no Render, use `npm ci`. Após alteração de banco:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
```

## Trial e planos

Novos tenants entram como `trial_pendente`; após verificar e-mail, começam Premium por 7 dias. Starter/Pro/Premium têm autorização aplicada no backend.

## Importante

Nenhuma revisão estática garante ausência total de vulnerabilidades. Antes de clientes pagantes em escala, use um ambiente staging e faça testes dinâmicos autorizados de isolamento de tenant, permissões, webhooks, sessões, uploads, pagamentos e concorrência de agenda.


## Planos comerciais atuais
- Starter — R$ 59,90/mês ou R$ 599/ano — até 2 profissionais, agenda, clientes, serviços e página pública.
- Pro — R$ 109,90/mês ou R$ 1.099/ano — até 5 profissionais, equipe, financeiro, produtos/estoque, PDV, loja pública, comissões, fila, avaliações e Mercado Pago.
- Premium — R$ 189,90/mês ou R$ 1.899/ano — profissionais ilimitados, loja pública, automações, WhatsApp, personalização, CRM, fidelidade, relatórios avançados e base preparada para IA.

### Próxima etapa: IA no WhatsApp
A versão atual **não envia respostas por IA ainda**. Ela já contém configuração multi-tenant, política de ferramentas permitidas e contadores de uso sem dar acesso direto ao banco. A integração futura deve chamar somente ferramentas controladas do BarberFlow (consultar horários, criar/reagendar/cancelar agendamento, listar serviços/preços e gerar link de pagamento).

## Pré-lançamento 2.1
- Onboarding guiado no Dashboard com progresso real.
- Central de Suporte acessível mesmo com assinatura inativa; gestão no Supermaster.
- Termos, Privacidade, LGPD e Cancelamento + registro de aceite no cadastro.
- Saúde operacional no Supermaster e alertas webhook opcionais para falhas 5xx.
- Backup lógico criptografado (`npm run backup`) com upload remoto opcional.
- Checkout interno Pix/cartão, migração de planos, 2FA e preparação para IA mantidos.

Consulte `LANCAMENTO.md`, `BACKUP-PRODUCAO.md` e `LEGAL-README.md` antes de abrir o SaaS ao público.

## Pagamentos 2.2
- Nova área **Pagamentos** no menu para Dono/Gerente.
- Mercado Pago: conta da própria barbearia conectada por OAuth, com Pix/cartão já processados pelo BarberFlow.
- PagBank: conector Connect preparado.
- Asaas: conexão por API Key da própria barbearia, validada e criptografada.
- Pagar.me: conexão por Secret/Public Key da própria barbearia, validada e criptografada.
- Stripe: scaffold de Connect preparado; antes de ativar pagamentos, será adotado/revisado o onboarding recomendado pela Stripe.
- Conexões são isoladas por `barbearia_id`; segredos não são enviados ao frontend após o cadastro.

Consulte `PAGAMENTOS-GATEWAYS.md` para configuração e limites desta versão.


## Pagamentos 2.3

Gateways e checkout agora ficam totalmente centralizados em **Pagamentos**. A aba Configurações não possui mais recebimentos. Mercado Pago, PagBank, Asaas, Pagar.me e Stripe ficam prontos para receber as credenciais do dono da barbearia; apenas o driver Mercado Pago está ativo no checkout nesta etapa. Veja `PAGAMENTOS-GATEWAYS.md`.

## BarberFlow 2.8 — Marketing
- Central Premium com visão geral, campanhas, públicos, cupons, indicações, links rastreáveis e modelos WhatsApp.
- Segmentação por aniversariantes, novos, inativos, VIP, frequência, faltas, compradores e carrinho abandonado.
- Consentimento promocional explícito no cliente, agendamento público e checkout da loja, com opt-out por SAIR/PARAR.
- Campanhas pela WhatsApp Cloud API usando templates aprovados, lotes, retry e acompanhamento de enviado/entregue/lido.
- Links rastreáveis conectam campanhas à agenda/loja e atribuem conversões e receita.
- Cupons server-side e programa de indicação com recompensas automáticas.
- Schema preparado automaticamente no boot; não depende de comandos manuais no Render.
