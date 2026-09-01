# EliteFlow 4.4.4 — Aprovação de Pix manual otimizada no mobile

## Correções
- Modal de confirmação de Pix no dashboard convertido em bottom sheet mobile com cabeçalho fixo, conteúdo rolável e rodapé de ações sticky.
- Botão **Confirmar Pix recebido** permanece sempre acessível, inclusive em telas baixas e aparelhos com safe area.
- Cards de Pix pendente no dashboard passam a usar botão em largura total no mobile.
- Página **Pagamentos > Pix manual** ganhou o mesmo modal de confirmação, removendo o `confirm()` nativo do navegador.
- O modal da página de Pagamentos também informa se a confirmação foi enviada ao cliente pelo WhatsApp.
- Cache-busting atualizado para CSS/JS 4.4.4.

## Segurança
A confirmação continua protegida no backend por papel, assinatura, isolamento de barbearia e step-up. A mudança é de UX/responsividade e não reduz as validações existentes.
