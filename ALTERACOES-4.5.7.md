# EliteFlow 4.5.7

## Exclusão segura pelo dono

- Zona de risco visível exclusivamente para o papel `dono` em Configurações > Segurança.
- Confirmação em duas etapas: ciência explícita, digitação de `EXCLUIR` e step-up por senha ou TOTP.
- Cancelamento da cobrança recorrente antes de qualquer bloqueio local; se o provedor falhar, a exclusão é interrompida.
- Encerramento das sessões de todos os usuários e bloqueio imediato da operação.
- Retenção recuperável por 30 dias, seguida pelo expurgo permanente já existente na manutenção.
- Link individual de restauração por dono, armazenado somente como hash, com uso único e expiração.
- Restauração não reativa a assinatura automaticamente.
- Rota pública de recuperação protegida por rate limit e resposta genérica para tokens inválidos.
- Auditoria das solicitações e restaurações, sem registrar os tokens.

## Interface

- Modal responsivo de confirmação, com estados claros em modo escuro e claro.
- Página pública de restauração que exige clique intencional e evita ativação por scanners de e-mail.
- Página de confirmação após a solicitação, incluindo alerta quando o e-mail de recuperação não for entregue.
