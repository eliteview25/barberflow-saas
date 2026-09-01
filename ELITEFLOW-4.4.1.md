# EliteFlow 4.4.1 — Aprovação de Pix no Dashboard

## Objetivo
Tornar a confirmação de Pix manual operacionalmente simples e garantir que o cliente seja avisado assim que a equipe aprovar o recebimento.

## Alterações
- Nova área **Pix aguardando aprovação** na tela inicial para Dono, Gerente e Recepção.
- Lista cliente, telefone, serviço, profissional, data, horário e valor.
- Confirmação por modal próprio, sem `confirm()` nativo do navegador.
- A confirmação continua protegida pelo step-up de segurança existente.
- Ao confirmar o Pix, o backend cria o agendamento e tenta enviar imediatamente a confirmação pelo WhatsApp conectado da barbearia.
- A API agora informa ao painel se a mensagem foi realmente enviada.
- Se o WhatsApp estiver desconectado ou o telefone for inválido, o agendamento permanece confirmado e o painel mostra o motivo da falha de comunicação.
- Mensagem de confirmação mais detalhada com serviço, profissional, data, hora, pagamento, código de acompanhamento e link de gerenciamento.

## Segurança
- A reserva é buscada por `id + barbearia_id` e bloqueada em transação.
- A vaga é novamente validada antes de criar o agendamento.
- A confirmação manual exige papel autorizado e step-up.
- Falha no provedor de WhatsApp não desfaz uma transação de pagamento/agendamento já confirmada.
- Clique repetido não cria segundo agendamento.
