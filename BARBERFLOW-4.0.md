# BarberFlow 4.0.0 — Visual Premium + Checkout de cartão externo

## Identidade visual
- Design system carvão + âmbar inspirado na identidade oficial BarberFlow.
- Fundo principal carvão/preto, superfícies em grafite, bordas discretas e ações em dourado/âmbar.
- Aplicado ao shell, sidebar, dashboards, agenda, clientes, equipe, serviços, comandas, financeiro, marketing, configurações, assinaturas, Supermaster, autenticação, modais e página pública.
- Mobile revisado com appbar/drawer escuros e ações de toque com contraste alto.
- Favicon 3.3.2 preservado.

## Assinaturas
- Pix continua sendo gerado e acompanhado dentro do BarberFlow.
- Cartão não é mais coletado pelo frontend do BarberFlow.
- Ao selecionar Cartão, o backend cria uma assinatura Mercado Pago `pending`, recebe o `init_point` e o navegador segue para o checkout oficial do Mercado Pago.
- A rota antiga de cartão embutido responde 410 e orienta o uso do checkout externo.
- O recebimento da assinatura continua usando a conta Mercado Pago central configurada pelo Supermaster.

## Deploy
- Não há nova migração de banco específica desta versão.
- Não exige reconexão do WhatsApp/Evolution.
- Não altera a configuração do Cloudinary.
