# EliteFlow 4.3.0

Revisão de segurança completa do pacote 4.2.0.

## Principais mudanças

- verificação obrigatória de e-mail antes do trial e do primeiro login;
- senha forte de 12+ caracteres, limite compatível com bcrypt e validação em todos os fluxos;
- JWT HS256 com emissor, audiência e `jti`, sessão por cookie seguro, CSRF e revogação por versão;
- bloqueio persistente por conta contra força bruta, inclusive login, MFA e step-up;
- MFA TOTP anti-replay e MFA obrigatório no Supermaster;
- autorização reforçada por papel, assinatura, recurso, tenant ativo e tipo de tenant;
- correções de isolamento multi-tenant em rotas operacionais, marketing e loja;
- webhooks com HMAC, janela temporal, idempotência e reconciliação defensiva;
- checkout restrito ao domínio oficial do Mercado Pago e OAuth com state hash + PKCE criptografado;
- payloads brutos de Mercado Pago/WhatsApp removidos de respostas e logs;
- uploads validados por assinatura, tipo, tamanho, dimensões, recodificação e remoção de metadados;
- CSP, CORS, HTTPS/HSTS, limites de corpo/URL e headers de segurança endurecidos;
- produção fail-closed para TLS, Turnstile, e-mail, backup remoto e segredos exclusivos;
- dados sensíveis removidos antes da IA, entrada tratada como não confiável, JSON Schema e allowlist de ferramentas;
- dependências diretas atualizadas e lockfile único em `backend/package-lock.json`;
- documentação e testes de regressão atualizados.

## Compatibilidade e deploy

- execute `npm run migrate` antes de iniciar a nova versão;
- usuários com sessão antiga podem precisar entrar novamente;
- novos cadastros dependem de Resend/remetente válido para confirmar o e-mail;
- produção exige as novas variáveis descritas em `PRODUCAO.md`;
- mantenha uma cópia segura das chaves antigas ao rotacionar criptografia de dados já armazenados.

## Validação do pacote

Na revisão de entrega: 155 arquivos JavaScript passaram na checagem de sintaxe, 258 testes passaram, a auditoria estática terminou sem falhas/avisos e o lockfile não apresentou vulnerabilidades conhecidas no `npm audit` offline.

Consulte `SECURITY-AUDIT-4.3.0.md` para o escopo, controles e riscos operacionais residuais.
