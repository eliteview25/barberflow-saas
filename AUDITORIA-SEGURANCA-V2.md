# EliteFlow — Auditoria de Segurança V2

Data da revisão: 26/08/2026.

## Escopo

Revisão estática aprofundada do backend Node/Express, frontend estático, migrações PostgreSQL, autenticação, autorização multi-tenant, Supermaster, agenda pública, pagamentos Mercado Pago, webhooks Meta/Mercado Pago, uploads, PDV/estoque, automações e scripts operacionais.

Esta revisão também tratou falhas de **integridade financeira, concorrência e confiabilidade**, mesmo quando elas não dependiam de um atacante.

## Correções principais

### Autenticação e Supermaster
- sessão em cookie `HttpOnly` com proteção CSRF;
- JWT restrito a HS256 e com `token_version` para revogação;
- troca/reset de senha invalida sessões anteriores;
- Supermaster exige MFA TOTP e step-up para ações críticas;
- Supermaster fica em tenant interno `is_system=true`, separado de clientes;
- trigger no PostgreSQL impede `super_admin` em tenant de cliente e usuário comum no tenant interno;
- trilha de auditoria para ações críticas do Supermaster.

### Isolamento multi-tenant
- consultas operacionais revisadas para sempre combinar IDs com `barbearia_id`;
- FKs compostas `(barbearia_id,id)` em relacionamentos sensíveis;
- constraints são validadas durante a migração para não mascarar dados legados inconsistentes;
- tenant interno não entra em métricas, financeiro ou listagem de clientes do Supermaster.

### Agenda pública e antiabuso
- self-service usa token público aleatório, nunca ID sequencial como credencial;
- OTP é armazenado como HMAC com pepper e consumido dentro da mesma transação;
- Turnstile com action/hostname em produção;
- rate limits para agenda e solicitação de OTP;
- advisory lock por slot para reduzir corrida de agendamento;
- serviço interno de booking para integrações confiáveis, sem burlar o fluxo público.

### Pagamentos e PDV
- sinal passa a ser `parcial`, não `pago`;
- venda separa `total`, `valor_pre_pago` e `valor_recebido`;
- snapshot de preço preserva histórico financeiro;
- venda final duplicada do mesmo agendamento é bloqueada;
- estoque, quantidade, desconto e comissão recebem validação de aplicação + constraints;
- Mercado Pago reconcilia `external_reference`, moeda e valor esperado;
- roteamento de credencial por tenant no webhook usa HMAC próprio do EliteFlow;
- mudança manual de plano é conciliada com o provedor para não criar divergência silenciosa.

### Webhooks e integrações
- assinaturas Mercado Pago e Meta são validadas antes do processamento;
- inbox durável `webhook_events` com idempotência, retry, backoff, recuperação de claim e falha permanente;
- ID lógico da notificação Mercado Pago é priorizado para idempotência;
- chamadas externas possuem timeout/cancelamento;
- refresh OAuth Mercado Pago é serializado.

### Upload e exportação
- upload não depende mais de Multer; valida bytes/magic bytes e dimensões antes do envio ao Cloudinary;
- transformação remove metadados do arquivo;
- CSV neutraliza células iniciadas com caracteres de fórmula.

## Dependências

Multer foi removido do runtime porque o fluxo de upload V2 não precisa mais dele. Isso também evita manter uma superfície desnecessária de multipart; em 2026 foram publicados avisos de DoS para versões anteriores a 2.2.0.

**Importante:** este pacote não contém um `package-lock.json` inventado/offline. Ao aplicar a V2 sobre o repositório real, rode `npm install` dentro de `backend` com internet para atualizar o lockfile e remover Multer dele; depois versione o novo `package-lock.json` e use `npm ci` no Render.

## Validação executada nesta cópia

- `npm test`: **18/18 testes aprovados**;
- `npm run check`: **68 arquivos JavaScript aprovados**;
- `npm run audit:security`: **0 falhas**, 1 aviso esperado (lockfile ausente na cópia de auditoria);
- `npm run qa`: aprovado;
- varredura de arquivos sensíveis: nenhum `.env`, chave privada ou arquivo de certificado encontrado;
- varredura estática de padrões comuns de segredo: nenhuma ocorrência conhecida encontrada.

## O que ainda precisa ocorrer em staging/Render

A cópia local não possui credenciais do banco nem deve possuí-las. Portanto estes testes dependem do ambiente real/staging:

```bash
npm run migrate
npm run verify
npm run audit:config
npm run audit:pilot
npm run maintenance
npm run smoke:security
npm run audit:deps
```

Também é necessário testar dinamicamente, com contas de tenants diferentes:
- IDOR/tenant escape;
- elevação de papel;
- sessão revogada;
- CSRF/CSP;
- retries/replay de webhooks;
- concorrência de dois bookings no mesmo slot;
- sinal + quitação no PDV;
- pagamento com valor/referência divergente;
- upload inválido/malformado;
- ações críticas do Supermaster com/sem step-up.

## Limite da auditoria

Este documento **não certifica o EliteFlow como 100% seguro**. É uma revisão estática e de regressão muito mais profunda da base atual. Segurança de produção exige teste dinâmico, monitoramento, atualização contínua de dependências, backups e resposta a incidentes.
