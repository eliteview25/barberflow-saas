# Checklist de segurança pré-deploy — 4.3.0

## Código e dependências

- [ ] O deploy usa exatamente `backend/package-lock.json` e `npm ci`.
- [ ] `npm run qa` termina com todos os testes aprovados e auditoria estática sem falhas.
- [ ] `npm run audit:deps` não apresenta vulnerabilidade alta ou crítica.
- [ ] Nenhum `.env`, backup, log, chave privada ou credencial está no pacote/commit.
- [ ] A migração `npm run migrate` foi executada antes de liberar tráfego.

## Ambiente

- [ ] `npm run audit:config` passa com `NODE_ENV=production`.
- [ ] `APP_URL` e integrações usam HTTPS.
- [ ] PostgreSQL usa TLS com validação do certificado.
- [ ] Todos os segredos obrigatórios têm 48+ caracteres, são aleatórios e distintos.
- [ ] Turnstile, OTP público e verificação de e-mail estão ativos.
- [ ] Resend/remetente estão configurados e a entrega de verificação foi testada.
- [ ] Backup criptografado é enviado para storage remoto e uma restauração foi testada.

## Contas e autorização

- [ ] Supermaster está em tenant de sistema e possui MFA configurado.
- [ ] Dono, gerente, recepção e barbeiro foram testados separadamente.
- [ ] Uma conta de uma barbearia não consegue ler ou alterar IDs de outra.
- [ ] Ações críticas exigem step-up; códigos TOTP não podem ser reutilizados.
- [ ] Logout e troca de senha revogam as sessões esperadas.

## Interfaces públicas e integrações

- [ ] Cadastro exige verificação de e-mail antes de iniciar o trial.
- [ ] Agenda pública exige Turnstile + OTP e aplica limites de tentativa.
- [ ] Upload aceita somente imagem válida, limita bytes/dimensões e remove metadados.
- [ ] Webhooks inválidos, antigos e repetidos são rejeitados.
- [ ] Checkout redireciona somente para host oficial do Mercado Pago.
- [ ] Erros de provedor não devolvem payload, segredo, SQL ou stack ao cliente.
- [ ] IA não recebe segredos/PII desnecessária e só executa ferramentas permitidas.

## Operação

- [ ] CDN/WAF e rate limit distribuído estão configurados para múltiplas instâncias.
- [ ] Alertas cobrem 5xx, força bruta, falhas de webhook e falhas de backup.
- [ ] `npm run smoke:security` passou em staging autorizado.
- [ ] Existe plano de resposta a incidente, rotação de chaves e contato de suporte.

Não abra o sistema ao público se qualquer item obrigatório estiver pendente.
