# EliteFlow 2.9 — 4 provedores de WhatsApp

A conexão do WhatsApp passa a ser escolhida por barbearia em **Configurações → Automações → WhatsApp**. É possível manter mais de um provedor salvo e definir somente um como ativo.

## Opções

### Meta Cloud API direta
- Oficial.
- A barbearia informa Phone Number ID, WABA ID (opcional), número e Access Token.
- O Access Token é criptografado no banco e nunca volta ao navegador.
- O App Secret da aplicação é uma configuração da infraestrutura (`META_WHATSAPP_APP_SECRET`).
- Usa templates aprovados fora da janela permitida pelo WhatsApp.

### 360dialog
- Parceiro oficial.
- A barbearia informa sua API Key e número.
- A API Key é criptografada.
- O EliteFlow tenta cadastrar automaticamente o webhook; se a conta não permitir, mostra a URL para cadastro manual.
- A estrutura de mensagens/templates segue o formato WhatsApp Business.

### Twilio
- Parceiro oficial.
- A barbearia informa Account SID, Auth Token e WhatsApp Sender.
- O Auth Token é criptografado.
- As credenciais são verificadas antes de salvar a conexão como válida.
- Templates usam **Content SID (HX...)** e Content Variables.
- O webhook é autenticado por `X-Twilio-Signature`.

### Evolution / QR Code
- Alternativa baseada em sessão do WhatsApp vinculada por QR Code.
- Requer `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` configurados na infraestrutura do EliteFlow.
- O cliente escaneia o QR Code em Dispositivos conectados.
- Pode atender e enviar mensagens livres; automações/Marketing usam texto em vez de template oficial.
- O painel exibe aviso de que essa alternativa pode ser menos estável e não é a API oficial da Meta.

## Provedor ativo

Uma barbearia pode deixar, por exemplo, Meta e Twilio conectados simultaneamente, mas somente um é usado por:
- atendimento e fluxo de agendamento;
- lembretes;
- Marketing;
- futura IA.

A troca do provedor ativo é protegida pelo step-up do EliteFlow. Se 2FA estiver ativo, pede o código; caso contrário, pede a senha. Ao desconectar o provedor ativo, o sistema seleciona automaticamente outra conexão disponível quando existir.

## Compatibilidade

As conexões Meta e Evolution que já existiam antes da 2.9 são migradas automaticamente para a nova tabela `whatsapp_conexoes`. As tabelas antigas são mantidas temporariamente para compatibilidade com frontends em cache, e os endpoints antigos principais continuam respondendo.

## Segurança

- segredos ficam criptografados com AES-GCM pelo serviço de secrets do EliteFlow;
- tokens privados de webhook são armazenados criptografados e também por hash para identificação;
- webhooks Meta validam HMAC SHA-256;
- webhooks Twilio validam `X-Twilio-Signature`;
- 360dialog/Evolution recebem URL privada por conexão;
- operações de conectar, ativar e desconectar exigem step-up;
- cada conexão é isolada por `barbearia_id`.

## Deploy

O schema é preparado automaticamente durante o boot. Não é necessário executar migração manual no Render.
