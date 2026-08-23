# 💈 BarberFlow

Sistema SaaS completo para gestão e agendamento de barbearias.

O **BarberFlow** foi desenvolvido para ajudar barbearias a organizar clientes, profissionais, serviços, horários e agendamentos em uma única plataforma.

Cada barbearia possui seu próprio ambiente isolado e uma página pública de agendamento, permitindo que clientes marquem horários online sem precisar criar uma conta.

---

## 🚀 Principais recursos

### 📊 Dashboard
Visão geral da operação da barbearia, com informações importantes sobre atendimentos e desempenho.

### 📅 Agendamentos
Gerenciamento completo da agenda com:

- Cliente
- Barbeiro
- Serviço
- Data
- Horário
- Status do atendimento

O sistema verifica automaticamente conflitos de horários.

### 🌐 Agendamento público

Cada barbearia possui sua própria página pública.

Exemplo:

`/agendar/minha-barbearia`

O cliente pode:

1. escolher o serviço;
2. escolher o barbeiro;
3. selecionar uma data;
4. visualizar horários disponíveis;
5. informar seus dados;
6. confirmar o agendamento.

Não é necessário login para o cliente.

### 👥 Clientes

Cadastro e gerenciamento da base de clientes da barbearia.

### 💈 Barbeiros

Gerenciamento dos profissionais e configuração individual dos horários de trabalho.

### ✂️ Serviços

Cadastro dos serviços oferecidos, incluindo:

- nome;
- duração;
- preço.

### 👤 Equipe e permissões

O BarberFlow possui diferentes níveis de acesso:

- Dono
- Gerente
- Recepção
- Barbeiro

Cada usuário possui acesso somente às funcionalidades necessárias para sua função.

### 🏢 Multiempresa

O BarberFlow foi desenvolvido como um sistema SaaS multiempresa.

Cada barbearia possui seus próprios:

- usuários;
- clientes;
- barbeiros;
- serviços;
- agendamentos;
- configurações;
- dados financeiros.

Os dados das barbearias permanecem separados.

### 💳 Assinaturas

Estrutura para comercialização do BarberFlow através de planos recorrentes.

Integração com Mercado Pago para gerenciamento de assinaturas e pagamentos.

---

## 🛠️ Tecnologias

### Front-end

- HTML5
- CSS3
- JavaScript

### Back-end

- Node.js
- Express.js
- API REST

### Banco de dados

- PostgreSQL

### Segurança e autenticação

- JWT
- bcrypt
- Controle de acesso por perfil
- Isolamento multiempresa

### Pagamentos

- Mercado Pago

---

## 🏗️ Arquitetura

```text
Cliente
   ↓
Frontend
   ↓
API REST
   ↓
Node.js + Express
   ↓
PostgreSQL
