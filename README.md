# BarberFlow SaaS 2.0

MVP SaaS de gestão e agendamento para barbearias, construído com Node.js, Express, PostgreSQL e frontend HTML/CSS/JavaScript.

## O que já funciona

- Cadastro de uma nova barbearia com 14 dias de trial
- Login com JWT e senhas protegidas com bcrypt
- Multiempresa: clientes, agenda, barbeiros e serviços são isolados por `barbearia_id`
- Usuários por barbearia e papéis `dono`, `gerente` e `recepcao`
- CRUD de clientes + histórico
- CRUD/ativação de barbeiros + expediente semanal
- CRUD/ativação de serviços + duração + preço
- Agenda com criar, editar, confirmar, iniciar, concluir e cancelar
- Prevenção de conflito de horários
- Dashboard com indicadores e faturamento do mês
- Financeiro por período (atendimentos concluídos)
- Página pública por slug: `/agendar/nome-da-barbearia`
- Cliente público cria/atualiza cadastro pelo telefone e agenda sozinho
- Configurações da barbearia e link público
- Planos Starter / Pro / Premium e tabela de assinatura/trial
- Recuperação de senha (fluxo local; em produção conectar um provedor de e-mail)
- Helmet + rate limit nas rotas sensíveis
- Backend serve o frontend: não precisa de Live Server

## Instalação no Windows

1. Tenha PostgreSQL e Node.js instalados.
2. Entre no backend:

```powershell
cd backend
npm install
Copy-Item .env.example .env
notepad .env
```

3. Preencha `.env`:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barberflow
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_POSTGRES
JWT_SECRET=USE_UMA_CHAVE_GRANDE_ALEATORIA
APP_URL=http://localhost:3001
BOOTSTRAP_ADMIN_EMAIL=admin@barberflow.local
BOOTSTRAP_ADMIN_PASSWORD=TroqueEstaSenha123!
```

4. Rode a migração e depois o servidor:

```powershell
npm run migrate
npm start
```

5. Abra `http://localhost:3001`.

### Banco antigo

A migração não apaga os dados antigos. Registros legados sem `barbearia_id` são vinculados à **Barbearia Demo**. O usuário inicial usa `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` do `.env`.

### Banco vazio

A mesma migração cria todas as tabelas do zero.

## Rotas principais

### Autenticação
- `POST /api/auth/registrar`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/solicitar-reset`
- `POST /api/auth/redefinir-senha`

### Painel autenticado
- `/api/clientes`
- `/api/barbeiros`
- `/api/servicos`
- `/api/agendamentos`
- `/api/dashboard`
- `/api/configuracoes`
- `/api/usuarios`
- `/api/assinatura`

### Público
- `GET /api/publico/:slug`
- `GET /api/publico/:slug/horarios`
- `POST /api/publico/:slug/agendar`

## Status do agendamento

`agendado` → `confirmado` → `em_atendimento` → `concluido`

Alternativas: `cancelado` e `nao_compareceu`.

## Assinatura e pagamentos

O banco e a interface de planos já existem. O endpoint `/api/assinatura/selecionar-plano` permite testar o fluxo. Para cobrar clientes reais, conecte **Mercado Pago** ou **Stripe** no backend e atualize `assinaturas.status`, `referencia_externa` e `proxima_cobranca` através dos webhooks oficiais do provedor.

Não coloque chaves secretas de pagamento no frontend.

## Recuperação de senha em produção

O backend gera tokens de uso único com validade de 30 minutos. Em desenvolvimento ele retorna `link_dev`. Em produção (`NODE_ENV=production`) conecte Resend, Postmark, SendGrid, SES ou outro provedor para enviar o link ao e-mail cadastrado.

## WhatsApp

A agenda já contém telefone do cliente e os pontos necessários para eventos (criação/confirmação/cancelamento). Para envio real, conecte uma API oficial/fornecedor no backend. Não exponha token do WhatsApp no frontend.

Sugestão de eventos:
- agendamento criado → confirmação
- 24h antes → lembrete
- alteração/cancelamento → aviso

## Checklist antes de vender

- Trocar `JWT_SECRET` e senha bootstrap
- Usar PostgreSQL hospedado com backups
- HTTPS obrigatório
- Configurar domínio
- Conectar provedor de cobrança
- Conectar e-mail para recuperação de senha
- Criar política de privacidade e termos (LGPD)
- Configurar monitoramento/logs e backups
- Testar concorrência de horários em ambiente de produção
- Limitar CORS ao domínio da aplicação

## Deploy sugerido

Uma configuração simples:
- Aplicação Node/Express: Render, Railway, Fly.io ou VPS
- PostgreSQL: Neon, Supabase Postgres, Railway ou serviço gerenciado
- Domínio: `app.seudominio.com`
- O próprio Express serve o frontend e a API na mesma origem.

No ambiente de produção configure `NODE_ENV=production`, `APP_URL=https://app.seudominio.com`, credenciais do banco e `JWT_SECRET`.

## Próximas integrações comerciais

O núcleo SaaS está pronto para evolução. As integrações que dependem de terceiros são: cobrança automática, WhatsApp transacional e envio de e-mail. O código foi estruturado para essas integrações entrarem no backend sem alterar o modelo multiempresa.

## Equipe e permissões

A versão inclui controle de acesso no backend e no menu do painel:

- **Dono:** acesso total, equipe, configurações, financeiro e assinatura.
- **Gerente:** operação, clientes, barbeiros, serviços, financeiro, configurações e visualização da equipe.
- **Recepção:** clientes e agendamentos; não administra preço, equipe, assinatura ou configurações.
- **Barbeiro:** enxerga somente a própria agenda e pode avançar o status dos próprios atendimentos.

Para atualizar um banco que já estava rodando, execute novamente:

```powershell
cd backend
npm run migrate
npm start
```

Depois entre como Dono e use **Equipe e acessos** para criar usuários. Ao criar um usuário com papel Barbeiro, vincule-o ao barbeiro correspondente.

## Dashboard Master
Defina `MASTER_ADMIN_EMAIL` e `MASTER_ADMIN_PASSWORD` (mínimo 12 caracteres) no ambiente e rode `npm run migrate`. Essa conta recebe papel `super_admin` e acessa `/master.html`, onde é possível acompanhar barbearias, MRR estimado, trials, assinaturas, uso, bloquear/ativar tenants e ajustar plano/status.

## Mobile
O painel possui drawer lateral, navegação inferior, tabelas em cards, modais em bottom-sheet e página pública otimizada para telas pequenas.

## Pagamento antecipado no agendamento público

A página pública agora suporta três modos por barbearia, configuráveis em **Configurações → Pagamento no agendamento**:

- `nenhum`: agenda imediatamente, sem cobrança;
- `total`: reserva o horário e cobra 100% do serviço;
- `sinal`: reserva o horário e cobra o percentual configurado.

Quando há cobrança, o BarberFlow cria uma reserva temporária (padrão: 15 minutos), bloqueia o horário para outros clientes e cria uma preferência Checkout Pro no Mercado Pago. O agendamento só é criado como `confirmado` quando o pagamento é aprovado pelo webhook ou pela sincronização do retorno do Checkout Pro.

Variável opcional:

```env
BOOKING_HOLD_MINUTES=15
```

### Importante para o SaaS multiempresa

Nesta versão, o fluxo de pagamento de agendamento reutiliza `MP_ACCESS_TOKEN` e é adequado para validar a experiência ponta a ponta. Antes de cobrar clientes reais de várias barbearias, o modelo correto é **Mercado Pago Marketplace + OAuth**, conectando a conta de cada barbearia. Assim, cada pagamento é processado com o Access Token do vendedor e pode ter `marketplace_fee` para a plataforma. Não use uma única conta Mercado Pago global para receber valores pertencentes a barbearias independentes em produção.

## Personalização da página pública
A barbearia pode configurar logo e banner por URL, cores principal/secundária/botão/fundo, tema claro/escuro, textos, Instagram, WhatsApp, política de cancelamento e visibilidade de preço/duração. Após atualizar esta versão, execute `npm run migrate` para criar os novos campos.


## Pagamentos por barbearia (Marketplace)

A versão multiempresa permite que o dono configure em **Configurações > Recebimentos**:

- Mercado Pago conectado à própria conta via OAuth;
- Pix pelo Mercado Pago;
- cartão pelo Mercado Pago;
- Pix manual (chave, recebedor e banco);
- dinheiro no local;
- cobrança total, sinal percentual ou sem cobrança antecipada.

Para o OAuth do Mercado Pago, configure no Render/Web Service:

```env
MP_CLIENT_ID=ID_DA_APLICACAO_MERCADO_PAGO
MP_CLIENT_SECRET=SEGREDO_DA_APLICACAO
MP_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/mercadopago/callback
MP_TOKEN_ENCRYPTION_KEY=UMA_CHAVE_LONGA_ALEATORIA
MP_MARKETPLACE_FEE_PERCENT=0
```

A `MP_TOKEN_ENCRYPTION_KEY` é usada para criptografar Access Token e Refresh Token antes de salvá-los no PostgreSQL. Não compartilhe esta chave e não a altere depois de barbearias estarem conectadas sem antes planejar uma rotação dos tokens.

No painel Mercado Pago Developers, a **Redirect URL** da aplicação deve ser exatamente a mesma de `MP_OAUTH_REDIRECT_URI`.

O `MP_ACCESS_TOKEN` global continua sendo usado apenas pela cobrança da assinatura do próprio BarberFlow. Pagamentos de clientes usam o Access Token OAuth da barbearia.

### Fluxos de pagamento

- **Mercado Pago:** reserva o horário, abre Checkout Pro e confirma automaticamente via webhook.
- **Pix manual:** reserva o horário e mostra a chave Pix; dono/gerente/recepção confirma o recebimento no painel.
- **Dinheiro:** cria o agendamento com pagamento pendente para recebimento no atendimento.

Depois de atualizar esta versão em produção, rode:

```bash
npm run migrate
npm run verify
```

## Planos e trial

Novas contas começam com **Premium em trial por 7 dias**.

- **Starter**: agenda, clientes, barbeiros e serviços.
- **Pro**: tudo do Starter + equipe, financeiro básico, página pública simples e pagamentos online.
- **Premium**: tudo do Pro + personalização completa da página pública, gráficos financeiros e base de automações.

Os bloqueios são aplicados no backend e no frontend. Dados de recursos Premium são preservados em downgrade e voltam a aparecer após upgrade.

# Atualização: WhatsApp, automações, mídia e escala

## WhatsApp Premium
A área **Automações** permite cadastrar as credenciais da WhatsApp Business Platform / Cloud API por barbearia. O token é criptografado no banco com `APP_SECRETS_ENCRYPTION_KEY`.

O bot conversa com o cliente pelo próprio WhatsApp e usa o mesmo motor público do BarberFlow:

`serviço → barbeiro → data → horário → nome → pagamento → confirmação`.

Formas suportadas no fluxo: Mercado Pago conectado pela barbearia, Pix manual e dinheiro, conforme a configuração do tenant.

Variáveis:

```env
APP_SECRETS_ENCRYPTION_KEY=CHAVE_LONGA
META_WHATSAPP_VERIFY_TOKEN=TOKEN_DE_VERIFICACAO
WHATSAPP_GRAPH_VERSION=v23.0
CRON_SECRET=SEGREDO_DO_CRON
```

Webhook Meta:

```text
GET/POST https://SEU_DOMINIO/api/whatsapp/webhook
```

Consulte `WHATSAPP.md` para setup, templates e cron.

## Automações Premium
O BarberFlow suporta lembretes de 24h, 2h e pós-atendimento. Mensagens proativas usam templates aprovados no WhatsApp Manager. O processamento é idempotente por `agendamento_id + tipo` para evitar envio duplicado.

Configure um Cron Job para chamar:

```text
POST /api/cron/automacoes/processar
Header: x-barberflow-cron: <CRON_SECRET>
```

## Upload direto de logo e banner
No Premium, Configurações oferece **Enviar logo** e **Enviar banner**. As imagens são armazenadas no Cloudinary, nunca no disco efêmero do Web Service.

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Financeiro Premium
Além do resumo do Pro, Premium recebe gráficos de faturamento dos últimos seis meses e ranking mensal de barbeiros.

## Checks antes do deploy

```bash
npm run check
npm run audit:config
npm run migrate
npm run verify
```

- `check`: sintaxe e presença de módulos críticos;
- `audit:config`: valida variáveis importantes e alerta integrações incompletas;
- `verify`: conexão e estrutura básica do PostgreSQL.

Leia também `ESCALABILIDADE.md`.
