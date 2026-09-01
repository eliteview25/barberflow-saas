# EliteFlow 4.4.9 — disponibilidade do WhatsApp e intervalo de almoço

Correção da automação do WhatsApp para usar a agenda real como fonte de verdade em tempo real.

## Correções

- Revalidação do horário no momento em que o cliente escolhe uma opção.
- Se o expediente ou almoço mudar durante a conversa, a lista antiga é descartada e uma nova lista é enviada.
- Perguntas de disponibilidade tratadas pela IA não podem mais usar resposta livre para afirmar que um barbeiro está disponível.
- Quando há serviço, barbeiro, data e horário, a IA consulta `slotContext`, que valida expediente, almoço, agendamentos e reservas pendentes.
- A criação final continua protegida pela mesma validação central.

## Compatibilidade

Nenhuma nova variável de ambiente e nenhuma migração manual de banco é necessária.
