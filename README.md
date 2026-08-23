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
