# BarberFlow — checklist pré-deploy

## Implementado nesta revisão

- APIs operacionais de agenda, clientes, barbeiros, serviços e PDV continuam bloqueadas por assinatura no servidor.
- `GET /api/configuracoes` e `PUT /api/configuracoes` agora também exigem assinatura ativa/trial válido.
- Pagamentos manuais pendentes também exigem assinatura operacional ativa.
- Login, logout, `/me`, consulta/checkout/sincronização/cancelamento da assinatura continuam disponíveis para recuperação da conta.
- Página pública já é removida quando a assinatura da barbearia não está ativa/trial válido.
- Código seguro público possui formato estrito, rate limit dedicado e é mascarado na interface.
- OTP mantém HMAC/pepper, expiração e máximo de 5 tentativas por código.
- Campos públicos relevantes possuem validação e limites no backend.
- Testes de isolamento multi-tenant foram adicionados para CRUD principal e gates de assinatura.
- Mobile recebeu reforço para safe areas, overflow, toque, modais, CTA e telas estreitas.

## Ações manuais obrigatórias antes de produção

1. **Rotacione as duas senhas compartilhadas durante os testes.** Não reutilize as antigas.
2. Em Render, configure um segredo exclusivo e aleatório para `BOOKING_OTP_PEPPER`.
3. Confirme que `.env` nunca entra no Git/ZIP. O pacote entregue nesta revisão exclui esse arquivo.
4. Cloudinary e Evolution/QR são opcionais; se não forem usados, mantenha-os desabilitados.
5. Após publicar, execute `npm run verify`, `npm run audit:config`, `npm run audit:pilot` e `npm run smoke:security` no ambiente autorizado.

## Risco aceito

A verificação obrigatória de e-mail no cadastro está desativada por decisão de produto. O Turnstile, senha forte e limites de requisição permanecem ativos, mas o sistema não comprova posse do endereço de e-mail no cadastro.
