# EliteFlow 4.1.0

## Visual
- Layout estrutural redesenhado a partir da identidade visual EliteFlow: sidebar compacta, topbar com busca, notificações e foto do dono, dashboard com gráficos reais, ranking e agenda.
- Mobile com appbar, foto do dono, próximo agendamento, grade de atalhos e navegação inferior por ícones.
- Agenda, clientes, assinatura e página pública seguem o mesmo design system carvão + âmbar.
- Poppins é carregada como tipografia principal, com fallback seguro do sistema.

## Assinatura por cartão
- Cartão continua 100% no checkout oficial do Mercado Pago.
- Se a API criar a assinatura sem devolver `init_point`, o EliteFlow usa o `preapproval_id` para abrir o checkout oficial.
- O webhook reconhece referências mensais e anuais (`barberflow:tenant:plano:ciclo`).
- Se a assinatura já existir no Mercado Pago e houver falha local de persistência, o cliente ainda é redirecionado e o webhook reconcilia depois.

### Validação visual
- Dashboard desktop foi comparado com o mockup aprovado: 4 KPIs, agenda à esquerda, faturamento em barras à direita e ranking de barbeiros.
- Mobile foi comparado com o mockup aprovado: appbar, retrato do dono, próximo atendimento, 6 atalhos, resumo do dia e bottom navigation.
