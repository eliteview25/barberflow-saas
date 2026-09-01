# Backup de produção

Execute `npm run backup` por um job isolado e periódico. O processo gera backup lógico, compacta com gzip, cifra com AES-256-GCM usando `BACKUP_ENCRYPTION_KEY` e envia para `BACKUP_UPLOAD_URL`.

Em produção, um arquivo apenas no disco local não deve ser considerado backup durável e é tratado como falha: esse disco pode ser efêmero. Use storage externo com controle de acesso, criptografia, retenção, versionamento/imutabilidade e registro de auditoria.

Requisitos:

- chave aleatória exclusiva de 48+ caracteres, armazenada fora do banco e do backup;
- política de retenção compatível com LGPD e necessidade do negócio;
- cópia em domínio de falha diferente do banco principal;
- alerta automático para execução ausente ou falha;
- teste periódico de restauração em ambiente isolado;
- rotação documentada da chave sem perder acesso às cópias antigas.

Para recuperação ponto no tempo e escala maior, habilite também backup/PITR gerenciado no provedor PostgreSQL. Um backup só é confiável depois que a restauração foi comprovada.
