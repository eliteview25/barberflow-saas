# EliteFlow — Mapa Resumido de Dados Pessoais

## Titulares
- donos/gestores da barbearia;
- recepção e barbeiros;
- clientes finais;
- compradores da loja quando habilitada;
- contatos de suporte.

## Fontes
- cadastro direto;
- barbearia/equipe;
- página pública;
- WhatsApp;
- Mercado Pago e integrações;
- eventos técnicos e logs;
- suporte.

## Sistemas/tabelas principais
`usuarios`, `barbearias`, `clientes`, `barbeiros`, `agendamentos`, `reservas_pagamento`, `vendas`, `loja_pedidos`, `marketing_*`, `whatsapp_sessoes`, `webhook_events`, `support_tickets`, `audit_logs`, `legal_acceptances`, `booking_otps`, `auth_login_attempts`.

## Dados potencialmente mais críticos
- credenciais/segredos de integração (cifrados);
- dados financeiros e identificadores de pagamento;
- códigos/tokens de autenticação (hash/cookies protegidos);
- conteúdo de suporte e WhatsApp;
- endereço de entrega;
- observações livres cadastradas por barbearias.

## Recomendação de minimização
Não usar o campo de observações para saúde, religião, biometria, documentos ou qualquer dado sensível que não seja estritamente necessário. Evitar anexos e mensagens com senha, 2FA ou dados completos de cartão.
