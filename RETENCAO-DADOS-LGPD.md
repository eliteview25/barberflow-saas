# EliteFlow — Política Técnica de Retenção

Revisão: 01/09/2026. Os prazos abaixo descrevem a implementação atual e devem ser conciliados com obrigações legais/contratuais.

| Dado | Implementação atual | Observação |
|---|---|---|
| Sessão autenticada | até 12h | cookie HttpOnly |
| Step-up | até 10 min | ação sensível |
| Booking OTP | expira em minutos; limpeza após até 2 dias | hash, não código em claro |
| Reset/verificação de e-mail | limpeza de expirados/usados após 7 dias | tokens em hash |
| Tentativas de login | 30 dias | prevenção a abuso |
| Sessão temporária WhatsApp | 3 dias sem atividade | estado do fluxo |
| Webhooks processados | 90 dias | troubleshooting/idempotência |
| Tenant enviado à lixeira | 30 dias | bloqueado e recuperável |
| Tenant após purge | removido do banco ativo | backups seguem rotação própria |
| Opt-out promocional | enquanto necessário para respeitar a oposição | evita reativação indevida |
| Incidentes LGPD | mínimo 5 anos | exigência regulatória operacional |

## Backups
O `backup.js` cifra o backup, mas a retenção do storage remoto é externa ao código. Em produção, configure lifecycle documentado, acesso mínimo e exclusão automática; a Política de Privacidade não deve prometer remoção instantânea de backups.

## Registros legais e fiscais
Não elimine registros cuja retenção seja exigida por lei ou necessária ao exercício regular de direitos sem validar a obrigação aplicável. Nesses casos, segregue, limite acesso e elimine ao fim do período.
