# EliteFlow 4.4.3 — Intervalo de almoço por barbeiro

## O que mudou
- Cada dia do expediente do barbeiro pode ter um intervalo de almoço/pausa opcional, com início e fim próprios.
- O cadastro de barbeiros exibe o intervalo de forma responsiva no desktop e mobile.
- A página pública não oferece horários que coincidam ou atravessem o intervalo.
- O fluxo de agendamento do WhatsApp usa a mesma regra e também não oferece esses horários.
- A agenda interna não oferece horários no intervalo.
- A validação central do backend rejeita tentativas de criar/reagendar atendimentos que atravessem o intervalo, mesmo por chamada direta à API.
- O indicador de minutos disponíveis desconta o intervalo configurado.

## Banco
A inicialização adiciona automaticamente `intervalo_inicio` e `intervalo_fim` em `horarios_trabalho` e cria uma restrição para que o intervalo fique integralmente dentro do expediente.

## Exemplo
Expediente: 08:00–18:00
Intervalo: 12:00–13:00
Um serviço de 30 min não poderá iniciar 11:45, 12:00 ou 12:30, porque atravessaria/ocuparia o intervalo. O primeiro horário possível após o almoço será 13:00.
