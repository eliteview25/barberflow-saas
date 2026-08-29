# BarberFlow 2.8 — Central de Marketing

## Plano
O módulo Marketing é um recurso do plano Premium. O trial Premium também permite testar a área enquanto estiver ativo.

## Menu
Marketing possui áreas separadas para uso no desktop e mobile:
- Visão geral
- Campanhas
- Públicos
- Cupons
- Indicações
- Links rastreáveis
- Modelos WhatsApp

## Públicos e consentimento
Campanhas de marketing só usam clientes com `marketing_opt_in=true`.
O consentimento pode ser registrado no cadastro de cliente, no agendamento público ou no checkout da loja.
O cliente pode responder **SAIR** ou **PARAR** no WhatsApp para remover o consentimento. Se já possuir cadastro, pode autorizar novamente enviando **PROMOÇÕES**.

Segmentos disponíveis:
- todos com consentimento
- aniversariantes do mês
- novos clientes
- clientes inativos
- VIP por gasto em serviços + loja
- clientes frequentes
- faltosos
- compradores da loja
- carrinho abandonado

## Campanhas WhatsApp
Campanhas usam a conexão oficial da Meta WhatsApp Cloud API já configurada em Automações.
Para disparos fora da janela de atendimento, use um template aprovado pela Meta e cadastre no BarberFlow exatamente o nome do template e idioma.

O processador roda automaticamente no servidor, em lotes de até 25 destinatários por ciclo, com retry controlado. A entrega utiliza somente clientes do tenant e com consentimento.

### Botão rastreável em template
Para campanhas com botão para Agenda ou Loja, crie no template da Meta um botão de URL dinâmica com base:

`https://SEU-DOMINIO/m/{{1}}`

O BarberFlow envia somente o token dinâmico como parâmetro do botão. O clique é redirecionado para a agenda ou loja da própria barbearia e fica atribuído à campanha.

## Métricas
A Central acompanha:
- público-alvo
- mensagens enviadas
- erros
- entregas
- leituras
- cliques
- conversões
- receita atribuída
- investimento informado
- ROI

O webhook oficial do WhatsApp associa status `sent`, `delivered`, `read` e `failed` ao `message_id` da campanha.

## Cupons
Cupons são validados no backend do checkout da Loja. Podem ter:
- desconto percentual ou valor fixo
- pedido mínimo
- desconto máximo
- início e fim da validade
- limite total de usos
- limite por cliente
- cupom exclusivo de um cliente

O uso só é contabilizado quando o pedido pago é convertido em venda.

## Programa de indicação
O dono pode ativar recompensas para quem indica e para o novo cliente indicado.
Cada cliente possui um código/link próprio. Autoindicação é bloqueada. A recompensa é liberada somente após a primeira compra válida do indicado e vira cupom pessoal com uso único.

## Links rastreáveis
Links próprios `/m/<token>` podem apontar para:
- agendamento
- loja

Podem ser usados em Instagram, bio, anúncios, QR Code ou campanhas. O BarberFlow mede clique, conversão e receita atribuída. A rota possui rate limit próprio.

## Privacidade e boas práticas
O BarberFlow fornece ferramentas de consentimento e opt-out, mas a barbearia continua responsável pela base legal, conteúdo, frequência e adequação das comunicações que realiza com seus clientes.


## Segurança de ações sensíveis — 2.8.1
A confirmação de senha/2FA agora usa um modal responsivo do BarberFlow, com erro inline, mostrar senha, suporte a TOTP e sem prompt/alert do navegador. O primeiro setup obrigatório de 2FA do Supermaster usa o mesmo componente.
