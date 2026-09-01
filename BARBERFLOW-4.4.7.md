# BarberFlow 4.4.7 — confirmação de Pix em um clique

- A aprovação de Pix manual não abre mais o segundo modal de senha/2FA.
- O clique em **Confirmar Pix** executa diretamente a confirmação da reserva.
- Permanecem: autenticação, papéis Dono/Gerente/Recepção, assinatura ativa, isolamento por `barbearia_id`, lock da reserva/vaga e idempotência.
- Cada aprovação é registrada em `audit_logs` com usuário, barbearia, reserva, agendamento e resultado do envio por WhatsApp.
- A criação do agendamento e a mensagem de confirmação no WhatsApp continuam no mesmo fluxo.
- Step-up permanece obrigatório nas demais ações sensíveis do SaaS.
