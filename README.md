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
- Starter — R$ 69,90/mês ou R$ 699/ano — até 2 profissionais; agenda, clientes, serviços, página pública, financeiro, gráficos, produtos/estoque, PDV, comandas e comissões.
- Pro — R$ 119,90/mês ou R$ 1.199/ano — até 5 profissionais; tudo do Starter + equipe, pagamentos online, WhatsApp/automações, CRM, fila, avaliações, fidelidade, clube, marketing inteligente e relatórios avançados.
- Premium — R$ 199,90/mês ou R$ 1.999/ano — até 10 profissionais; tudo do Pro + página personalizada, BI avançado, exportação, NFS-e preparada e IA no WhatsApp com limite padrão de 500 atendimentos/mês quando configurada.
- Enterprise — sob consulta — operações com 11+ profissionais; contratação comercial, sem checkout automático.

O anual equivale a 10 mensalidades e libera 12 meses de uso. O trial permanece em 7 dias com recursos Premium.

### IA no WhatsApp
A IA é opcional e usa ferramentas controladas do BarberFlow, sem acesso direto ao banco. Quando `OPENAI_API_KEY` não está configurada ou a integração falha, o atendimento clássico continua funcionando. As ações continuam validadas pelo contexto do tenant e pelas regras de agenda.

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
- Campanhas pelo provedor WhatsApp ativo; provedores oficiais usam templates aprovados e Evolution/QR usa mensagem livre, com lotes, retry e métricas compatíveis com cada conexão.
- Links rastreáveis conectam campanhas à agenda/loja e atribuem conversões e receita.
- Cupons server-side e programa de indicação com recompensas automáticas.
- Schema preparado automaticamente no boot; não depende de comandos manuais no Render.


## BarberFlow 2.9 — WhatsApp com 4 provedores
- Cada barbearia escolhe entre Meta Cloud API, 360dialog, Twilio ou Evolution/QR Code.
- É possível manter várias conexões configuradas e definir uma como ativa.
- Marketing, lembretes, atendimento e futura IA usam a conexão ativa.
- Meta, 360dialog e Twilio são apresentados como opções oficiais; Evolution/QR é alternativa com aviso de estabilidade.
- Segredos ficam criptografados; webhooks e mudanças de provedor possuem proteções próprias.
- Conexões Meta/Evolution anteriores são migradas automaticamente no boot.

## BarberFlow 3.2

Dashboards por perfil e revisão de responsividade/mobile. Consulte `BARBERFLOW-3.2.md`.
