# EliteFlow 4.4.0 — Construtor de Fluxos do WhatsApp

## O que mudou

A área **Automações > WhatsApp** agora possui um construtor de fluxo por barbearia. Cada tenant pode manter vários fluxos, editar mensagens e gatilhos, duplicar configurações e definir qual fluxo está ativo.

### Fluxo padrão detalhado

O fluxo inicial cobre:

1. Entrada / boas-vindas
2. Escolha do serviço
3. Escolha do profissional
4. Data
5. Horário
6. Identificação do cliente
7. Forma de pagamento
8. Confirmação ou reserva pendente de pagamento

As mensagens possuem uma prévia semelhante a uma conversa no WhatsApp e aceitam variáveis controladas, como `{cliente}`, `{servico}`, `{barbeiro}`, `{data}`, `{hora}`, `{valor}`, `{link}` e `{pix_chave}`.

## Personalização por barbearia

O dono ou gerente pode:

- criar um fluxo;
- editar nome, descrição, gatilhos e mensagens;
- duplicar um fluxo existente;
- ativar um fluxo por vez;
- excluir fluxos inativos;
- visualizar uma prévia da mensagem antes de salvar.

O fluxo padrão é criado automaticamente para barbearias que ainda não possuam configuração própria.

## Segurança e integridade

A personalização não substitui as validações transacionais do backend. Serviço, profissional, data, disponibilidade do horário, tenant, cliente e pagamento continuam sendo validados pelo EliteFlow.

A tabela `whatsapp_fluxos` é isolada por `barbearia_id`, e um índice parcial garante somente um fluxo ativo por barbearia.

Variáveis indispensáveis são protegidas. Por exemplo:

- mensagem Pix precisa manter `{valor}` e `{pix_chave}`;
- mensagem Mercado Pago precisa manter `{link}`;
- etapas de seleção precisam manter `{opcoes}`.

Isso permite personalizar o atendimento sem permitir que uma mensagem alterada remova dados essenciais do processo.

## Banco de dados

A versão 4.4.0 cria automaticamente a tabela e os índices necessários durante a inicialização. A criação também foi adicionada ao migrador e ao `database/schema.sql`.

## Qualidade

- 265 testes automatizados aprovados;
- 6 testes novos dedicados ao construtor de fluxo;
- auditoria de segurança atualizada para 4.4.0;
- editor responsivo para desktop e mobile;
- sem `alert`, `prompt` ou `confirm` nativos no editor.
