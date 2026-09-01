# EliteFlow 4.5.2 — modo claro profissional

Esta versão refaz apenas a apresentação do modo claro. O modo escuro, a estrutura das telas, os breakpoints, as permissões e as regras de negócio permanecem iguais.

## Padrão adotado

- Canvas neutro `#F7F8FA`, superfície principal branca e superfície interna `#FAFBFC` para criar hierarquia sem depender de sombras fortes.
- Texto principal `#101828`, texto secundário `#344054` e texto auxiliar `#667085`.
- Bordas de conteúdo `#D0D5DD` e bordas mais perceptíveis em campos (`#8B95A5`).
- Dourado reservado para ações, foco e seleção; verde, azul, laranja e vermelho reservados a estados semânticos.
- Contraste mínimo de 4,5:1 para texto normal nas combinações centrais da paleta.
- Sidebar carvão preservada também no modo claro para manter a identidade e evitar controles claros dentro do menu escuro.

## Cobertura

Dashboard, Agenda, Clientes, Serviços, Financeiro, Gestão, WhatsApp e fluxos, Pagamentos, Assinatura, Marketing, Configurações, Segurança, Suporte, autenticação, documentos legais, notificações, modais e Supermaster.

## Referências

- Material Design 3 — papéis de cor e hierarquia de superfícies: https://m3.material.io/styles/color/roles
- Material Design 3 — especificação de cards: https://m3.material.io/components/cards/specs
- WCAG 2.2 — contraste mínimo de texto: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 — contraste de componentes: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Apple UI Design Tips — legibilidade, contraste, encaixe e áreas de interação: https://developer.apple.com/design/tips/

## Cache

Os assets locais usam a revisão `v=20260901-v452` para impedir que navegadores mantenham o CSS anterior.
