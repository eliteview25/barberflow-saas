# BarberFlow — Checkout de Planos

## Fluxos
- Cartão: assinatura recorrente via Mercado Pago. O cartão é tokenizado pelo SDK/Brick no navegador; o backend recebe o token, não número/CVV.
- Pix: pagamento mensal pré-pago. O QR Code e o Pix Copia e Cola são exibidos dentro do BarberFlow.
- Migração de plano com cartão recorrente ativo: atualiza a assinatura Mercado Pago existente, sem criar uma segunda assinatura.
- Downgrade: bloqueado quando a quantidade de profissionais ativos supera o limite do plano de destino.

## Variáveis do Mercado Pago
- `MP_ACCESS_TOKEN`: obrigatório para cobrança.
- `MP_PUBLIC_KEY`: necessária para o formulário de cartão embutido.
- `MP_WEBHOOK_SECRET` e `MP_TENANT_SIGNING_SECRET`: manter configuradas para validação/conciliação dos webhooks.

Se `MP_PUBLIC_KEY` não estiver configurada, o BarberFlow mantém o fallback de checkout externo para cartão.

A tabela `assinaturas_pagamentos` e as colunas necessárias são preparadas automaticamente no boot; não é necessário comando manual no Shell do Render.
