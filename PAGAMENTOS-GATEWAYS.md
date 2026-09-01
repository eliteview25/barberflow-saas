# EliteFlow 2.3 — Pagamentos centralizados

## Estrutura da tela

A área **Pagamentos** concentra tudo relacionado ao recebimento dos clientes da barbearia.

Ela possui três blocos:

1. **Gateways** — o dono informa as credenciais da própria conta em cada provedor.
2. **Checkout** — define cobrança antecipada, sinal, Pix, cartão, dinheiro e Pix manual.
3. **Pix manual** — confirma pagamentos que não passam por um gateway automático.

A aba **Configurações** não contém mais nenhuma opção de gateway, Pix, dinheiro ou checkout.

## Gateways preparados para credenciais

### Mercado Pago

Campos solicitados ao dono:

- Access Token
- Public Key

O Access Token fica criptografado. A Public Key é armazenada separadamente para uso futuro no frontend seguro do checkout.

O driver Mercado Pago já existente continua sendo o único processador online ativo nesta versão.

### PagBank

Campos solicitados:

- Token de autenticação
- Chave pública opcional nesta etapa

As credenciais ficam armazenadas para a implementação posterior do driver PagBank.

### Asaas

Campos solicitados:

- API Key
- Ambiente: produção ou sandbox

A chave fica criptografada.

### Pagar.me

Campos solicitados:

- Secret Key
- Public Key

A Secret Key fica criptografada.

### Stripe

Campos solicitados:

- Secret Key
- Publishable Key

A Secret Key fica criptografada.

## Segurança

- Apenas o papel `dono` pode salvar, trocar ou remover credenciais de gateways.
- Dono e gerente podem visualizar a configuração do checkout.
- Segredos nunca retornam pela API após serem salvos.
- A API retorna apenas se as credenciais estão salvas.
- Todas as integrações são isoladas por `barbearia_id`.
- Credenciais privadas usam `APP_SECRETS_ENCRYPTION_KEY`.
- Trocar uma credencial substitui o valor anterior; o valor antigo não é mostrado no navegador.

## Checkout

A tela permite configurar:

- sem cobrança antecipada;
- cobrança do valor total;
- cobrança de sinal percentual;
- Pix online via Mercado Pago;
- cartão online via Mercado Pago;
- Pix manual;
- dinheiro no atendimento.

PagBank, Asaas, Pagar.me e Stripe aparecem como gateways preparados para credenciais, mas ainda não podem ser selecionados como processador do checkout até seus drivers serem implementados.

## Importante

As credenciais Mercado Pago da **barbearia** são diferentes das credenciais globais usadas pelo EliteFlow para cobrar a assinatura do SaaS.

As variáveis `MP_ACCESS_TOKEN` e `MP_PUBLIC_KEY` do ambiente do servidor continuam sendo as credenciais da operação de assinatura do EliteFlow. As credenciais que o dono informa em **Pagamentos** ficam armazenadas por barbearia no banco, isoladas por tenant.
