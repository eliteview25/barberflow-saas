# BarberFlow 2.10 — foco operacional

- Loja/e-commerce removida da navegação principal.
- Produtos viraram módulo próprio: Produtos & Estoque.
- Vendas/PDV ganhou histórico de vendas.
- Equipe agrupa barbeiros, comissões e permissões.
- WhatsApp e automações aparecem como área própria.
- A página pública deixa de divulgar loja/produtos.
- O código antigo de e-commerce foi preservado, mas a vitrine pública fica desligada por padrão. Para um futuro produto opcional, a infraestrutura pode ser reativada explicitamente com `ENABLE_PUBLIC_STORE=true` após revisão de produto/segurança.
- Nenhuma tabela de pedidos/produtos foi apagada, evitando perda de dados e permitindo migração futura.
