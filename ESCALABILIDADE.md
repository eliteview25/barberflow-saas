# BarberFlow — preparação para escalabilidade

A versão atual já mantém `barbearia_id` em todos os dados operacionais e índices nas consultas críticas. Para crescer sem reescrever o produto, siga esta ordem:

1. **Banco** — PostgreSQL gerenciado, backups automáticos, pool de conexões e índices medidos com `EXPLAIN ANALYZE`.
2. **Web stateless** — não guardar sessão nem arquivos no disco do Render. JWT e imagens ficam fora da instância (Cloudinary).
3. **Jobs** — lembretes e tarefas pesadas saem do Web Service. O endpoint `/api/cron/automacoes/processar` pode ser chamado por um Cron Job com `x-barberflow-cron`.
4. **Filas** — quando o volume crescer, mover WhatsApp, webhooks e relatórios para Redis/BullMQ ou serviço equivalente.
5. **Cache** — serviços, barbeiros e configurações públicas são bons candidatos a Redis com TTL curto.
6. **Observabilidade** — logs estruturados, alertas de erro, latência, taxa de webhook e falhas de pagamento/WhatsApp.
7. **Tenant** — manter filtros por `barbearia_id` no backend e futuramente adicionar RLS no PostgreSQL para defesa em profundidade.
8. **Mídia** — nunca usar filesystem efêmero para logo/banner; usar Cloudinary/S3 compatível.
9. **Rate limit distribuído** — o limitador em memória atual serve para uma instância. Com múltiplas instâncias, usar store Redis.
10. **Deploy** — migrations separadas e compatíveis com rollback; staging antes de produção.

## Metas por estágio
- Até ~100 barbearias: Render Web + PostgreSQL gerenciado + Cloudinary + Cron.
- Centenas/milhares: múltiplas instâncias web, pooler, Redis, workers dedicados e observabilidade.
- Grande escala: particionamento/arquivamento de agendamentos, filas regionais e revisão de multi-região conforme métricas reais.
