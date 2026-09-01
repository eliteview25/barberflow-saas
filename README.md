# BarberFlow SaaS 4.4.7 — Pix em um clique + UI mobile refinada

SaaS multiempresa para gestão de barbearias com agenda, clientes, equipe, serviços, página pública, pagamentos, PDV/estoque, CRM, fidelidade, automações, Supermaster e planos Starter/Pro/Premium.

## Segurança desta versão

A base 4.3.0 passou por revisão integral do código seguindo OWASP Top 10 2025, OWASP API Security 2023, ASVS e OWASP Top 10 para aplicações com IA. Foram reforçados autenticação, autorização multi-tenant, MFA, sessões, webhooks, pagamentos, OAuth, uploads, erros, segredos, banco, backups e o agente de IA.

Leia **`HOTFIX-4.3.1.md`**, **`SECURITY-AUDIT-4.3.0.md`**, **`BARBERFLOW-4.3.0.md`** e **`PRE-DEPLOY-SECURITY.md`** antes do deploy.

## Local

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run migrate
npm start
```

## Produção

Use `backend` como diretório raiz, preserve `backend/package-lock.json` e instale sempre com `npm ci`. Após configurar o ambiente:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
npm run smoke:security
```

## Trial e planos

Novos tenants entram como `trial_pendente`; após verificar e-mail, começam Premium por 7 dias. Starter/Pro/Premium têm autorização aplicada no backend.

## Importante

Nenhuma revisão estática torna um sistema invulnerável. Antes de clientes pagantes em escala, use staging, execute testes dinâmicos autorizados e mantenha WAF/rate limit distribuído, monitoramento, rotação de segredos, atualização de dependências e testes reais de restauração de backup.


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

## BarberFlow 3.3 — fotos dos profissionais e exclusão por 2FA

- Dono e gerente podem adicionar ou remover foto no cadastro do barbeiro.
- O upload reutiliza o pipeline seguro de imagens e salva em Cloudinary; JPG/PNG de até 5 MB, com recorte quadrado e remoção de metadados.
- A página pública mostra os profissionais em cards com foto; quando não houver foto, exibe as iniciais.
- O banco recebe `barbeiros.foto_url` de forma idempotente durante o boot/migração.
- Exclusão de barbearia no Supermaster não exige mais digitar o nome. Cada exclusão normal ou permanente exige código TOTP do 2FA no próprio modal e possui rate limit dedicado.
- A exclusão normal continua recuperável por 30 dias; a permanente continua irreversível.

Para upload real das fotos, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no ambiente de produção. Não armazene imagens no disco efêmero do Render.


## 4.4.7
Aprovação de Pix manual em um clique, sem segundo modal de step-up, com registro de auditoria e controles de tenant/papel preservados.
