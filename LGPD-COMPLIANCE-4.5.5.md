# EliteFlow — Matriz de Conformidade LGPD (4.5.5)

Data da revisão: 01/09/2026.

## Escopo
A revisão cobre cadastro do SaaS, dados de barbearias e equipe, clientes finais, agenda, WhatsApp, marketing, pagamentos, suporte, logs, integrações, IA, backups e páginas públicas.

## Papéis
- EliteFlow controlador: cadastro da conta, assinatura, faturamento do SaaS, suporte, segurança e administração da plataforma.
- Barbearia controladora: dados de clientes e finalidades de agenda, CRM, marketing e operação.
- EliteFlow operador: tratamento desses dados por instrução da barbearia.
- Terceiros: papel varia conforme contrato/finalidade. Mercado Pago e plataformas de comunicação podem atuar como controladores independentes em determinadas operações.

## Controles existentes
- isolamento por `barbearia_id` e testes cross-tenant;
- sessão em cookie HttpOnly, CSRF, 2FA e step-up;
- rate limits e Turnstile;
- criptografia de segredos de integrações;
- webhooks assinados/idempotentes;
- registros de auditoria;
- exclusão tenant com lixeira de 30 dias;
- rotina de limpeza de OTP, tokens, tentativas de login, sessões WhatsApp e webhooks;
- opt-in promocional separado e opt-out via SAIR;
- cartão tokenizado/processado pelo provedor.

## Pendências operacionais obrigatórias
1. Informar razão social/nome, CNPJ/CPF quando aplicável, endereço e canal público de privacidade em produção.
2. Definir formalmente quem exerce a função de encarregado/DPO ou documentar a hipótese de dispensa aplicável.
3. Assinar/revisar contratos e DPAs com provedores que tratem dados por conta do EliteFlow.
4. Avaliar transferências internacionais e incorporar mecanismos da Resolução CD/ANPD nº 19/2024 quando aplicável.
5. Definir lifecycle real do storage de backup e provar restauração/exclusão por rotação.
6. Manter inventário de incidentes por pelo menos 5 anos.
7. Documentar teste de legítimo interesse sempre que essa base for utilizada.
8. Treinar equipe de suporte para autenticação proporcional de pedidos de titulares e resposta sem expor dados.
9. Rever periodicamente campanhas e templates para garantir opt-out e minimização.
10. Solicitar revisão por advogado brasileiro antes do lançamento comercial em escala.

## Não conformidade evitada na 4.5.5
A política antiga afirmava exclusão permanente de todos os dados após 30 dias sem ressalvar backup ou retenções legais; a nova redação diferencia banco ativo, backups e retenções permitidas/obrigatórias.
A política antiga não explicava cookies/localStorage, transferência internacional, papéis, IA, menores ou fornecedores.
O checkout de loja persistia automaticamente dados do comprador no localStorage; agora isso depende de escolha explícita.
