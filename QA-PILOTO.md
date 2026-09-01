# EliteFlow — QA e segurança antes do piloto

Execute:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
```

## Testes manuais prioritários

1. Cadastro sem Turnstile válido é rejeitado em produção.
2. Conta não verificada não consegue iniciar sessão normal; trial só começa após confirmação de e-mail.
3. Troca/reset de senha invalida sessão aberta anteriormente.
4. Supermaster exige TOTP no login e step-up antes de excluir tenant/alterar assinatura/perfil sensível.
5. Starter/Pro não acessam APIs Premium por URL direta.
6. Barbearia A não consegue referenciar IDs de cliente/barbeiro/serviço da Barbearia B.
7. Cancelar/reagendar/avaliar público só funciona com token público aleatório.
8. Agenda pública limita abuso por telefone e usa OTP nos fluxos não automatizados.
9. Dois clientes concorrentes não ocupam o mesmo intervalo.
10. Webhook Meta com HMAC inválido recebe 401.
11. Webhook Mercado Pago inválido recebe 401 e evento duplicado não é processado duas vezes.
12. PDV rejeita quantidade <= 0, desconto negativo/superior ao bruto e estoque insuficiente.
13. Upload rejeita conteúdo que não seja PNG/JPEG real e imagens acima dos limites.
14. Alterar preço de serviço não muda valores históricos de agendamentos concluídos.
15. Restaurar tenant não reativa cobrança externa automaticamente.
16. Assinatura Mercado Pago não aceita status manual divergente no Master.
17. CSP impede script inline não autorizado.
18. Cookies de sessão aparecem como HttpOnly/Secure em produção.

## Monitoramento

- `/api/health/live`
- `/api/health/ready`

## Próxima fase

Executar pentest dinâmico autorizado em staging antes de abrir onboarding pago em escala.
