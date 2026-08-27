# BarberFlow SaaS — Segurança V2 / Auditoria Profunda

SaaS multiempresa para gestão de barbearias com agenda, clientes, equipe, serviços, página pública, pagamentos, PDV/estoque, CRM, fidelidade, automações, Supermaster e planos Starter/Pro/Premium.

## Segurança desta versão

A V2 passou por uma revisão estática aprofundada de segurança, isolamento multi-tenant, concorrência, integridade financeira e confiabilidade de webhooks.

Leia **`AUDITORIA-SEGURANCA-V2.md`** e **`APLICAR-V2.md`** antes do deploy.

## Local

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run migrate
npm start
```

## Produção

Antes do primeiro deploy desta V2, rode `npm install` localmente dentro de `backend` e versione o `package-lock.json` atualizado. Depois, no Render, use `npm ci`. Após alteração de banco:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
npm run audit:security
```

## Trial e planos

Novos tenants entram como `trial_pendente`; após verificar e-mail, começam Premium por 7 dias. Starter/Pro/Premium têm autorização aplicada no backend.

## Importante

Nenhuma revisão estática garante ausência total de vulnerabilidades. Antes de clientes pagantes em escala, use um ambiente staging e faça testes dinâmicos autorizados de isolamento de tenant, permissões, webhooks, sessões, uploads, pagamentos e concorrência de agenda.


## Planos comerciais atuais
- Starter — R$ 49,90/mês — até 2 profissionais, agenda, clientes, serviços e página pública.
- Pro — R$ 89,90/mês — até 5 profissionais, equipe, financeiro, produtos/estoque, PDV, comissões, fila, avaliações e Mercado Pago.
- Premium — R$ 169,90/mês — profissionais ilimitados, automações, WhatsApp, personalização, CRM, fidelidade, relatórios avançados e base preparada para IA.

### Próxima etapa: IA no WhatsApp
A versão atual **não envia respostas por IA ainda**. Ela já contém configuração multi-tenant, política de ferramentas permitidas e contadores de uso sem dar acesso direto ao banco. A integração futura deve chamar somente ferramentas controladas do BarberFlow (consultar horários, criar/reagendar/cancelar agendamento, listar serviços/preços e gerar link de pagamento).
