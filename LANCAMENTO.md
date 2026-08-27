# BarberFlow — checklist de lançamento real

Esta versão foi preparada para piloto e lançamento comercial controlado.

## Fluxo que deve ser validado antes de abrir vendas
1. Criar uma conta nova e confirmar que o trial Premium inicia imediatamente.
2. Concluir o checklist do Dashboard: dados, barbeiro, serviço, horários e página pública.
3. Fazer um agendamento público real pelo celular e confirmar que aparece na Agenda.
4. Concluir atendimento, registrar recebimento/venda e conferir Financeiro/comissão/estoque.
5. Testar Starter, Pro e Premium: limites de profissionais e bloqueios de recursos.
6. Testar Pix de assinatura: gerar QR, pagar e sincronizar/confirmar pelo webhook.
7. Testar cartão de assinatura: checkout embutido com MP_PUBLIC_KEY e recorrência.
8. Testar upgrade e downgrade. Downgrade deve bloquear quando exceder limite de profissionais.
9. Testar cancelamento e reativação.
10. Testar recuperação de senha, 2FA e Central de Suporte.

## Infraestrutura que depende de configuração externa
- Domínio próprio/DNS: aponte o domínio para o serviço no Render e atualize APP_URL.
- Backup durável: o código gera backup lógico criptografado, mas retenção real exige BACKUP_UPLOAD_URL ou os backups gerenciados do PostgreSQL/Render.
- Alertas: configure ALERT_WEBHOOK_URL para receber falhas 5xx e erros críticos.
- Suporte direto: configure SUPPORT_EMAIL e/ou SUPPORT_WHATSAPP.
- Cartão embutido: configure MP_PUBLIC_KEY e MP_ACCESS_TOKEN.

## Critério sugerido para sair do piloto
Use 2–5 barbearias reais por alguns dias. Só abra aquisição em escala depois de não haver erros críticos no fluxo de cadastro, agenda, cobrança e suporte.
