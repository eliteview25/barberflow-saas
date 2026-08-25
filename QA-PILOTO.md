# BarberFlow — Checklist de piloto

Antes de colocar uma barbearia real, rode no backend:

```bash
npm run migrate
npm run verify
npm run qa
npm run audit:config
npm run audit:pilot
```

## Testes manuais obrigatórios

1. Cadastro novo inicia em Premium Trial por 7 dias.
2. Starter não acessa Equipe, Financeiro ou Gestão por menu nem por URL/API.
3. Pro acessa Equipe, Financeiro básico e página pública simples.
4. Premium acessa automações, personalização completa, PDV/estoque e relatórios.
5. Duas barbearias nunca enxergam dados uma da outra.
6. Página pública funciona sem autenticação.
7. Dois clientes não conseguem reservar o mesmo barbeiro/horário simultaneamente.
8. Cancelamento e reagendamento respeitam o tenant e a política da barbearia.
9. Pix manual permanece aguardando até confirmação do estabelecimento.
10. Venda no PDV reduz estoque e atualiza pagamento/agendamento quando vinculado.
11. Comissão não mistura vendas/agendamentos de outra barbearia.
12. Exportações CSV contêm somente dados do tenant autenticado.
13. Usuário barbeiro vê somente a própria agenda.
14. Super Admin acessa Master; usuários comuns recebem 403/redirecionamento.
15. Mobile: agenda, formulários, modais, Gestão e página pública são utilizáveis em 360 px.

## Rotas de monitoramento

- `/api/health/live`: processo HTTP está vivo.
- `/api/health/ready`: processo + PostgreSQL estão prontos.

Configure o monitor externo para consultar `/api/health/ready` a cada 1–5 minutos.

## Manutenção

Execute periodicamente:

```bash
npm run maintenance
```

A rotina expira reservas antigas e remove estados OAuth, resets e sessões conversacionais antigas.

## Antes de cliente pagante

- Trocar qualquer segredo que tenha aparecido em conversa/log.
- HTTPS obrigatório.
- Webhooks Mercado Pago validados por assinatura.
- Backup do PostgreSQL habilitado e recuperação testada.
- Monitor de uptime configurado.
- Política de privacidade, termos e canal de suporte publicados.
