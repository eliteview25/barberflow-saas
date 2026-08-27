# Backup de produção

O projeto inclui `npm run backup`.

Ele cria um backup lógico completo em JSON, compacta com gzip e criptografa com AES-256-GCM antes de gravar o arquivo `.bfbackup`. A chave vem de `BACKUP_ENCRYPTION_KEY` e nunca deve ser versionada.

## Importante
O disco local de um serviço web pode ser efêmero. Um arquivo criado apenas em `BACKUP_DIR` **não deve ser considerado backup durável**.

Para produção configure `BACKUP_UPLOAD_URL` para um storage externo/endpoint de retenção e agende `npm run backup` em um job periódico da infraestrutura. O Supermaster mostra o resultado do último backup em Saúde do sistema.

Para escala maior, prefira também backups/PITR gerenciados pelo provedor PostgreSQL.
