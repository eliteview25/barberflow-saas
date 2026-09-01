# Checkout dos planos EliteFlow

## Fluxos atuais
- **Pix:** cobrança criada dentro do EliteFlow com QR Code Mercado Pago. A aprovação é reconciliada por webhook e consulta de status.
- **Cartão:** o EliteFlow cria uma assinatura `pending` na conta Mercado Pago configurada pelo Supermaster e redireciona o dono da barbearia para o **checkout oficial do Mercado Pago**. O EliteFlow não coleta número do cartão, validade nem CVV.
- **Migração de plano com cartão recorrente ativo:** atualiza a assinatura Mercado Pago existente, sem criar uma segunda assinatura.

## Credenciais
A cobrança das assinaturas SaaS usa exclusivamente a conta Mercado Pago configurada em **Supermaster → Pagamentos**.

- `Access Token` de produção: obrigatório para criar e consultar cobranças/assinaturas.
- `Public Key`: pode permanecer cadastrada para diagnóstico/compatibilidade, mas não é usada para coletar cartão no checkout de assinatura 4.1.
- Segredo de webhook: recomendado/obrigatório conforme a configuração de produção para validar notificações.

## Recuperação do cartão
O checkout 4.1 é tolerante a respostas incompletas/timeouts:
1. tenta reutilizar uma assinatura `pending` já salva;
2. se houver `preapproval_id` salvo sem URL, consulta diretamente a preapproval;
3. pesquisa a assinatura por `external_reference` antes de criar outra;
4. se o Mercado Pago não devolver `init_point`, constrói a URL oficial usando o `preapproval_id`;
5. o webhook reconcilia `barberflow:<tenant>:<plano>:<mensal|anual>`.

Isso evita o caso em que o Mercado Pago cria a assinatura, mas o EliteFlow exibe erro e cria outra tentativa.
