# EliteFlow 4.5.3 — revisão do modo principal

Esta versão padroniza somente o modo escuro principal. O modo claro 4.5.2, a estrutura, os tamanhos, os breakpoints, as permissões e as regras de negócio permanecem iguais.

## Diagnóstico

- A identidade carvão e âmbar já era adequada ao produto.
- As cores estavam muito fragmentadas: o CSS possuía centenas de valores hexadecimais acumulados ao longo das versões.
- Várias áreas internas usavam `#0B0E12` dentro de cards `#111419`, produzindo uma camada mais escura onde o padrão de dark mode usa elevação mais clara.
- Textos auxiliares como `#606A75` e `#68727D` sobre `#0B0E12` ficavam abaixo de 4,5:1.
- Bordas dos campos não tinham contraste suficiente para delimitar o controle sem depender do foco.

## Padrão adotado

- Canvas `#0A0C0F`.
- Superfície principal `#11151A`.
- Superfície suave `#14191F`.
- Superfície elevada `#171C22`.
- Overlay `#1C222A`.
- Texto principal `#F5F7FA`, secundário `#D0D5DD` e auxiliar `#98A2B3`.
- Placeholder `#8B95A3` e borda de controles `#5B6878`.
- Dourado reservado a ações, foco e seleção; verde, azul, amarelo, vermelho e roxo reservados a estados semânticos.
- Sombras discretas; a diferença de superfície comunica a maior parte da elevação.

## Cobertura

Dashboard, Agenda, Clientes, Serviços, Financeiro, Gestão, WhatsApp e fluxos, Pagamentos, Assinatura, Marketing, Configurações, Segurança, Suporte, notificações, modais, autenticação, documentos legais, Supermaster e telas mobile.

## Referências

- GitHub Primer — color usage e tokens: https://primer.style/product/getting-started/foundations/color-usage/
- Atlassian — elevação no dark mode: https://atlassian.design/foundations/elevation
- Atlassian — tokens e temas: https://atlassian.design/tokens/design-tokens
- IBM Carbon — temas e camadas: https://carbondesignsystem.com/elements/themes/overview/
- IBM Carbon — uso de cores no dark mode: https://carbondesignsystem.com/elements/color/overview/
- Material Design 3 — papéis de cor: https://m3.material.io/styles/color/roles
- WCAG 2.2 — contraste de texto: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 — contraste de componentes: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

## Cache

Os assets locais usam a revisão `v=20260901-v453` para impedir a reutilização do CSS anterior.
