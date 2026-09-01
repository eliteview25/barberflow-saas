# EliteFlow 3.3.4 — Checkout de cartão

Correções no checkout de assinatura por cartão:

- libera `https://secure-fields.mercadopago.com` na CSP para os Secure Fields PCI do Mercado Pago;
- impede duas renderizações concorrentes do Card Payment Brick;
- exibe estado de carregamento enquanto o formulário seguro é inicializado;
- exibe fallback para Checkout Mercado Pago quando o Brick não puder ser carregado;
- mantém número do cartão, validade e CVV fora do backend EliteFlow; somente o token é enviado para a API interna.

Não há migração de banco nesta versão.
