# WhatsApp no BarberFlow

O BarberFlow oferece dois modos separados no plano Premium.

## 1. WhatsApp Oficial — Cloud API

É o modo recomendado para produção e é o único usado pelo bot de agendamento conversacional.

A barbearia configura no painel:
- Phone Number ID;
- WhatsApp Business Account ID;
- número;
- Access Token.

O **Verify Token não fica mais no Render**. O dono clica em **Gerar Verify Token** na área Automações, copia o token e informa esse mesmo valor na configuração de webhook da Meta. O BarberFlow salva apenas o hash desse token; se ele for perdido, basta gerar outro.

Callback compartilhado:

```text
https://SEU_DOMINIO/api/whatsapp/webhook
```

A Meta envia o `hub.verify_token` na validação; o BarberFlow identifica qual token cadastrado corresponde ao valor recebido.

## 2. WhatsApp por QR — somente lembretes

Este modo existe apenas como alternativa para envio de lembretes de 24h, 2h e pós-atendimento. Ele **não lê conversas, não recebe comandos e não executa o bot de agendamento**.

A interface mostra um QR Code que o dono escaneia em:

```text
WhatsApp > Dispositivos conectados > Conectar dispositivo
```

Para manter as sessões QR fora do processo principal do SaaS, o BarberFlow usa um conector Evolution API separado. Configure na infraestrutura:

```env
EVOLUTION_API_URL=https://evolution.seu-dominio.com
EVOLUTION_API_KEY=uma-chave-forte
```

A instância de cada barbearia é criada automaticamente e isolada pelo ID do tenant.

> Atenção: o modo QR usa WhatsApp Web/Baileys, não a WhatsApp Business Platform oficial. Pode desconectar, exigir novo QR e sofrer mudanças de compatibilidade. Para operação crítica, agendamento conversacional e maior estabilidade, use a Cloud API oficial.

## Lembretes

Na tela Automações o dono escolhe o canal:

- **Cloud API**: exige templates aprovados para mensagens proativas;
- **QR**: envia texto configurável diretamente pela sessão conectada.

As mensagens QR aceitam as variáveis:

```text
{cliente}
{servico}
{barbeiro}
{data}
{hora}
```

O job de lembretes continua sendo disparado por:

```text
POST /api/cron/automacoes/processar
Header: x-barberflow-cron: CRON_SECRET
```

O controle `agendamento_id + tipo` continua evitando envio duplicado.
