# EliteFlow 4.1.1

## Correção do checkout por cartão

- Corrige os parâmetros da query PostgreSQL que adquire o lock da alteração de assinatura.
- Evita o erro local que podia ocorrer depois de o Mercado Pago já ter criado a assinatura.
- Mantém o cartão no checkout oficial do Mercado Pago e o fallback por `preapproval_id` da versão 4.1.0.
- Inclui teste de regressão para impedir que parâmetros SQL não contíguos voltem ao fluxo.

## Validação

- Suíte completa: 224 testes aprovados.
