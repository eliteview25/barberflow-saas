# BarberFlow 3.2.0 — Perfis e Mobile Fit

## Objetivo

A versão 3.2.0 refina a experiência do BarberFlow por função e corrige fontes estruturais de overflow em telas pequenas.

## Dashboards por perfil

### Dono / Gerente
- visão do negócio, equipe, agenda e caixa;
- receita prevista, ticket médio, ocupação e próximos atendimentos;
- atalhos operacionais e de crescimento conforme plano/permissão.

### Recepção
- foco no fluxo do dia;
- agendamentos, confirmados, em atendimento e atrasados;
- ações rápidas para novo agendamento, clientes, comandas e PDV;
- não consulta configurações administrativas indevidas.

### Barbeiro
- agenda limitada ao profissional vinculado;
- próximos clientes, concluídos, receita dos serviços e comissão estimada;
- acesso rápido à própria agenda e WhatsApp do cliente;
- proteção defensiva: conta sem barbeiro_id não recebe visão geral do tenant.

### Supermaster
- navegação com ícones SVG consistentes;
- indicadores de inadimplência e cancelamentos;
- resumo visual do mix de planos;
- acabamento do painel administrativo alinhado ao UI 2.0.

## Mobile / responsividade

- revisão para larguras pequenas, inclusive 320 px;
- remoção/correção de min-width que causavam estouro da viewport;
- grids, KPIs, cards, barras de ação, formulários e modais adaptativos;
- sidebar limitada à largura útil e com safe-area;
- tabelas comuns adaptadas ao mobile;
- agenda e cards de clientes compactados;
- matriz de recursos da assinatura usa rolagem horizontal local, sem empurrar a página inteira;
- cache-bust dos assets atualizado para v320.

## Banco de dados

Esta atualização não exige nova tabela nem migração de schema. As alterações são de interface, autorização defensiva e consultas do dashboard.

## Validação

- 135 arquivos JavaScript aprovados pela checagem interna do projeto;
- 191/191 testes automatizados aprovados;
- auditoria estática de segurança: 0 falhas e 0 avisos.

> Observação: a validação responsiva automatizada em navegador local não pôde ser usada neste ambiente porque acesso a localhost/file:// é bloqueado pela política do navegador. A revisão mobile foi validada por regras estruturais, testes de regressão e inspeção do código; faça o smoke visual final no domínio de staging/produção após o deploy.
