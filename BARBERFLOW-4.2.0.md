# BarberFlow 4.2.0

Central persistente de notificações para todos os perfis e para o Supermaster.

- Sininho conectado a uma API real, com contador individual de não lidas.
- Painel responsivo no desktop e bottom sheet no mobile.
- Leitura individual, “marcar todas como lidas” e atualização automática a cada minuto.
- Notificações de novos agendamentos, reagendamentos, cancelamentos e ausência.
- Alertas de Pix manual, pagamento confirmado e pagamentos que exigem revisão.
- Chamados e respostas de suporte ligados ao sininho.
- Novas barbearias, pagamentos de assinatura e falhas operacionais visíveis no Supermaster.
- Isolamento por barbearia, papel e usuário; barbeiros recebem somente avisos vinculados ao próprio profissional.
- Persistência no PostgreSQL com prevenção de duplicidade em webhooks e leituras separadas por usuário.
