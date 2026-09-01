# EliteFlow 4.3.1 — hotfix de inicialização em produção

## Problema

A validação adicionada na 4.3.0 classificava `LOGIN_THROTTLE_SECRET`, `BILLING_WEBHOOK_SECRET`, `BACKUP_UPLOAD_URL` e `BACKUP_ENCRYPTION_KEY` como obrigatórios para o processo HTTP iniciar. Isso fazia o Render encerrar com status 1 mesmo quando billing externo e backup remoto não eram necessários para servir a aplicação.

## Correção

- O boot de produção agora exige apenas configuração necessária para servir o EliteFlow com segurança.
- `LOGIN_THROTTLE_SECRET` é opcional: quando não configurado, a chave usada para anonimizar o identificador de login é derivada de `JWT_SECRET` com separação de finalidade via HMAC.
- `BILLING_WEBHOOK_SECRET` é opcional no boot. Sem ele, o endpoint de billing continua rejeitando assinaturas (fail closed).
- `BACKUP_UPLOAD_URL` e `BACKUP_ENCRYPTION_KEY` não derrubam mais o servidor HTTP. O comando `npm run backup` continua recusando backup de produção sem destino remoto e chave de criptografia.
- Se `BACKUP_UPLOAD_URL` for configurada, `BACKUP_ENCRYPTION_KEY` passa a ser obrigatória no boot e ambos continuam sujeitos à validação de HTTPS/segredo forte.
- Segredos opcionais, quando fornecidos, continuam exigindo 48+ caracteres, valor não previsível e não reutilização com outras finalidades.

## Render

Após publicar esta versão, o deploy não deve mais parar apenas pela ausência das quatro variáveis citadas no log. Configure backup remoto antes de ativar o job de backup de produção.
