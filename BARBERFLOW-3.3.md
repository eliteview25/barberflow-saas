# BarberFlow 3.3.0

## Fotos dos barbeiros

- `barbeiros.foto_url` é criado automaticamente com `ADD COLUMN IF NOT EXISTS`.
- Cadastro e edição do profissional possuem prévia, upload e remoção de foto.
- Upload: `POST /api/uploads/barbeiro-imagem`, somente dono/gerente autenticado com assinatura ativa.
- Formatos aceitos: JPG e PNG, máximo de 5 MB e dimensões defensivas.
- O arquivo é enviado ao Cloudinary em `barberflow/<tenant>/barbeiros`, convertido para WebP e tem metadados removidos.
- A página pública retorna `foto_url` e mostra cards de escolha do profissional. Sem foto, usa iniciais como fallback.

### Variáveis necessárias para upload

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Sem essas variáveis, o cadastro continua funcionando, mas o endpoint de upload informa que o armazenamento ainda não está configurado.

## Exclusão de barbearia no Supermaster

A confirmação por nome foi removida conforme a nova regra do produto.

- Exclusão para lixeira: exige código TOTP do 2FA no momento da ação.
- Exclusão permanente: também exige TOTP no momento da ação.
- O backend valida o 2FA; não é apenas uma confirmação visual do frontend.
- Tentativas de DELETE no recurso de barbearias do Master usam rate limit sensível.
- Se o Supermaster não tiver 2FA ativado, a exclusão é bloqueada.
- A lixeira continua com retenção de 30 dias.
- A exclusão permanente continua apagando os dados relacionados por meio do lifecycle existente.

## Compatibilidade

- Atualização idempotente de banco; não recria tabelas nem apaga dados existentes.
- Não altera a conexão WhatsApp/Evolution.
- Não exige novo QR Code do WhatsApp.
