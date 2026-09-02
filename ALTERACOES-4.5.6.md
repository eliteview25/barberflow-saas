# EliteFlow 4.5.6

## Modos de atendimento do WhatsApp

- Fluxo padrão e Inteligência Artificial agora possuem controles independentes.
- O dono ou gerente Premium pode usar somente o fluxo, somente a IA ou os dois juntos.
- Pelo menos um canal precisa permanecer ligado.
- Novas contas começam no fluxo padrão, sem consumo de IA.
- Contas antigas com IA ativa migram automaticamente para IA + fluxo.
- Contas fora do Premium usam o fluxo padrão, mesmo que exista uma configuração antiga de IA.
- Conversas em andamento preservam a sessão atual para não interromper agendamentos.

## Implantação

A coluna `ai_config.modo_atendimento` é criada e preenchida automaticamente durante a inicialização. Não é necessário executar SQL manual antes do deploy.
