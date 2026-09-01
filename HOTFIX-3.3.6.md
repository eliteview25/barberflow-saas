# EliteFlow 3.3.6 — Diagnóstico e resiliência Mercado Pago

- Valida se Access Token e Public Key pertencem ao mesmo ambiente.
- Consulta os meios de pagamento disponíveis na conta Mercado Pago central.
- Detecta Pix indisponível e orienta cadastrar/ativar chave Pix.
- Detecta ausência de cartão na conta conectada.
- Exibe no checkout o motivo retornado pela API, sem expor credenciais.
- Se a criação direta da assinatura com token de cartão falhar por regra de checkout, cria assinatura pendente e oferece o `init_point` oficial do Mercado Pago como fallback.
- Mantém a conta do Supermaster como única recebedora de Starter, Pro e Premium.
