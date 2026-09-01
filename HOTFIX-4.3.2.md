# EliteFlow 4.3.2 — Hotfix PostgreSQL TLS / Render

## Problema corrigido

A 4.3.1 exigia `rejectUnauthorized=true` em toda conexão PostgreSQL de produção. Em provedores que expõem PostgreSQL com TLS no modo `sslmode=require`, como a conexão externa do Render, o Node.js podia encerrar o boot com `self-signed certificate`.

## Correção

- `DB_SSL=true` continua obrigatório em produção.
- O padrão sem CA explícita passa a equivaler a `sslmode=require`: conexão criptografada, sem validação da cadeia da CA.
- Para validação estrita (`verify-full`), configure `DB_SSL_REJECT_UNAUTHORIZED=true` e `DB_SSL_CA` com a CA PEM do provedor.
- Nenhuma configuração global de TLS foi desativada; `NODE_TLS_REJECT_UNAUTHORIZED=0` não é utilizado.
- O auditor de configuração informa quando o banco está em modo `require` e recomenda CA para ambientes que exigem verificação estrita.

## Render

Com a configuração já usada no EliteFlow (`DB_SSL=true`), não é necessário adicionar uma variável insegura global. Faça apenas o deploy da 4.3.2. Se `DB_SSL_REJECT_UNAUTHORIZED=true` estiver atualmente definido no Render, altere para `false` ou remova a variável para usar o modo compatível `require`.
