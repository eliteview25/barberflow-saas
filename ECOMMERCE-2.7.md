# EliteFlow 2.7 — E-commerce, frete e step-up de segurança

## Segurança de ações importantes

O EliteFlow usa confirmação adicional (step-up) antes de alterações sensíveis.

- Se o usuário possui 2FA ativo, a confirmação pede somente o código TOTP atual de 6 dígitos.
- Se o usuário não possui 2FA ativo, a confirmação pede somente a senha da conta.
- A confirmação tem validade curta e não substitui a sessão normal do usuário.
- O código TOTP e a senha nunca são registrados em auditoria.

## Loja / e-commerce

A loja pública usa os produtos e o estoque já cadastrados no EliteFlow.

Fluxo principal:

1. Cliente adiciona produtos ao carrinho.
2. EliteFlow recalcula preços e disponibilidade no servidor.
3. Cliente escolhe retirada ou entrega.
4. Para entrega, o servidor calcula a distância e o frete.
5. O estoque é reservado temporariamente durante o pagamento.
6. Pix ou cartão é processado com a conta Mercado Pago da própria barbearia.
7. Somente após aprovação o pedido vira venda/faturamento.
8. Se o pagamento expirar/falhar, a reserva de estoque é devolvida.

### Formas de entrega

Em **Barbearia → Loja** é possível configurar:

- retirada no estabelecimento;
- entrega por distância;
- taxa base;
- preço por quilômetro;
- valor mínimo de frete;
- frete grátis dentro de determinada distância;
- frete grátis a partir de determinado valor do pedido;
- distância máxima de entrega;
- pedido mínimo;
- instruções para retirada.

## Cálculo de distância

Para produção, configure no Render Environment:

```text
GOOGLE_MAPS_ROUTES_API_KEY=
```

Quando a chave estiver presente, o backend usa Google Routes para distância por rota. Sem chave, o EliteFlow pode usar o fallback OpenStreetMap/Nominatim + OSRM quando `ROUTING_FALLBACK_OSM=true`.

O fallback é útil para piloto e contingência. Para volume comercial, recomenda-se configurar um provedor de rotas com SLA e limites adequados ao uso.

## Mercado Pago da barbearia

Em **Configurações → Pagamentos → Mercado Pago**, o dono informa:

- Access Token;
- Public Key;
- Segredo do webhook (recomendado para confirmação automática em segundo plano).

A Public Key pode ser enviada ao navegador. Access Token e segredo do webhook permanecem criptografados no backend.

O cartão é tokenizado no navegador pelo SDK do Mercado Pago; o EliteFlow não armazena número completo do cartão nem CVV.

O Pix mostra QR Code/copia e cola dentro da loja. A confirmação pode ocorrer pelo webhook e também por sincronização com o Mercado Pago.

## Pedidos

A área **Barbearia → Loja** permite acompanhar pedidos e avançar status de atendimento/entrega. Cancelamentos elegíveis de pedidos pagos pelo Mercado Pago podem acionar reembolso e estorno da venda vinculada.

## Banco de dados

As tabelas e colunas novas são preparadas automaticamente durante a inicialização do backend. Não é necessário executar migração manual pelo Shell do Render.
