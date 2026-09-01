# Auditoria de segurança — BarberFlow 4.3.0

Data da revisão: 1 de setembro de 2026.

## Resultado executivo

Todo o código-fonte do pacote BarberFlow 4.2.0 foi percorrido e a versão corrigida foi promovida para 4.3.0. No escopo estático revisado, não permaneceu achado conhecido de severidade alta ou crítica. A entrega passou em checagem de sintaxe, 258 testes, auditoria estática interna e auditoria offline do lockfile.

Isso não é uma promessa de invulnerabilidade: testes dinâmicos com infraestrutura real, configuração do provedor, WAF, monitoramento, rotação de chaves e restauração de backup continuam sendo controles obrigatórios.

## Referências adotadas

- OWASP Top 10 2025: https://owasp.org/Top10/2025/
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Top 10 for LLM Applications: https://genai.owasp.org/llm-top-10/

## Achados corrigidos

| Área | Risco tratado | Controle aplicado | Estado |
|---|---|---|---|
| Cadastro | contas sem comprovação do e-mail | token aleatório armazenado como hash, expiração, uso único e cooldown | Corrigido |
| Senhas | credenciais fracas/inconsistentes | 12+ caracteres, complexidade, máximo de 72 bytes e validação em todos os fluxos | Corrigido |
| Força bruta | limites somente por processo/IP | throttle persistente por conta com HMAC, atraso progressivo e `Retry-After` | Corrigido |
| MFA | reutilização de TOTP | consumo atômico do time-step no PostgreSQL | Corrigido |
| Sessões | JWT pouco restrito e sessão antiga | HS256 fixo, issuer, audience, `jti`, expiração, cookie seguro, CSRF e `token_version` | Corrigido |
| Autorização | acesso cruzado por ID/papel/tenant | gates de papel, plano e recurso; joins e updates com `barbearia_id`; tenant de sistema isolado | Corrigido |
| Supermaster | ações destrutivas sem garantia recente | MFA obrigatório, step-up anti-replay e trilha de auditoria sanitizada | Corrigido |
| Webhooks | falsificação, replay e duplicidade | HMAC constante, timestamp, janela máxima, inbox/idempotência e reconciliação | Corrigido |
| Pagamentos | open redirect e payload de provedor | allowlist Mercado Pago, códigos normalizados e nenhuma resposta bruta no cliente/log | Corrigido |
| OAuth | state/verifier expostos no banco | state armazenado como SHA-256, PKCE e verifier temporário cifrado com AES-GCM | Corrigido |
| Uploads | arquivo falso, bomba de imagem e metadados | magic bytes, tamanho, dimensões, recodificação, strip de metadados e rate limit | Corrigido |
| Erros | SQL, stack, token ou credencial em resposta | mensagens públicas curadas, `request_id` e logs estruturados/bounded | Corrigido |
| Segredos | fallback/reuso/configuração fraca | inicialização fail-closed e segredos de 48+ caracteres distintos por finalidade | Corrigido |
| Banco | tráfego sem validação TLS e queries longas | TLS obrigatório/validado em produção, pool e timeouts | Corrigido |
| IA | prompt injection, PII e saída livre | redação de dados, instruções de não confiança, JSON Schema, allowlist e validação server-side | Corrigido |
| Backups | cópia apenas em disco efêmero | cifra autenticada e destino remoto obrigatório em produção | Corrigido |
| Dependências | versões antigas/lock inconsistente | dependências diretas atualizadas, lockfile único e instalação com `npm ci` | Corrigido |

## Verificações executadas

```text
npm run check            155 arquivos JavaScript válidos
npm test                 258/258 testes aprovados
npm run audit:security   0 falhas, 0 avisos
npm audit --offline      0 vulnerabilidades conhecidas
```

Também foram verificados padrões de segredo, respostas com erro bruto, funções de execução dinâmica, SQL parametrizado, gates de autenticação/autorização, escopo multi-tenant, fluxos públicos, uploads, integrações e configuração de produção.

## Controles fora do código

Antes de produção, ainda é obrigatório:

1. executar DAST/pentest autorizado em staging com duas barbearias e todos os papéis;
2. usar CDN/WAF e rate limit compartilhado entre instâncias;
3. restringir rede/privilégios do PostgreSQL e manter patching do provedor;
4. guardar segredos em secret manager, rotacioná-los e monitorar uso anômalo;
5. habilitar alertas, retenção segura de logs e resposta a incidente;
6. validar assinatura/configuração real de cada provedor externo;
7. testar restauração de backup e recuperação de desastre;
8. reexecutar auditoria de dependências em todo deploy.

O `img-src https:` da CSP permanece amplo para suportar imagens externas configuráveis. O pipeline de upload recomendado é Cloudinary; se a operação não precisar de URLs externas, restrinja futuramente a diretiva aos hosts usados. Limites em memória continuam como primeira camada por IP, enquanto login/MFA/step-up usam estado persistente; em múltiplas instâncias, complemente com rate limit distribuído no edge.

## Nota operacional 4.3.1

O hotfix 4.3.1 separa requisitos de **boot HTTP** de requisitos de **jobs/integrações opcionais**. `BACKUP_UPLOAD_URL`, `BACKUP_ENCRYPTION_KEY` e `BILLING_WEBHOOK_SECRET` não derrubam mais o processo web quando ausentes. O job `npm run backup` permanece fail-closed em produção sem backup remoto, e o webhook billing permanece fail-closed sem segredo. `LOGIN_THROTTLE_SECRET` pode ser dedicado; quando ausente, a chave de anonimização é derivada de `JWT_SECRET` com separação de finalidade por HMAC.
