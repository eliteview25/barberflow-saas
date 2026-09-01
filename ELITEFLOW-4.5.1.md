# EliteFlow 4.5.1 — nova identidade textual

Esta versão altera exclusivamente a identidade do produto para **EliteFlow: Gestão de Barbearia**.

## Alterações

- Nome visível atualizado no login, cadastro, painel, páginas operacionais, Supermaster, loja, documentos legais, mensagens, e-mails e títulos do navegador.
- Logo textual atualizada para EliteFlow sem mudar classes, elementos, cores, tamanhos, espaçamentos ou comportamento responsivo.
- Iniciais de marca agora usam EF.
- Favicon atualizado da inicial B para E, preservando paleta, proporções e acabamento visual.
- Novos arquivos de exportação, backup, uploads e templates sugeridos usam o prefixo `eliteflow`.
- Pacote atualizado para `eliteflow-saas` na versão 4.5.1.

## Compatibilidade preservada

Alguns identificadores internos históricos continuam usando o prefixo técnico `barberflow`, incluindo emissor de sessão, referências de pagamentos existentes, nomes de instância do WhatsApp, headers de automação e o slug reservado do tenant de sistema. Eles não aparecem como marca na interface e foram mantidos para evitar logout geral, perda de conciliação de cobranças, desconexão do WhatsApp ou quebra de automações já configuradas.

Não houve alteração nas regras de CSS, layout, componentes, temas ou responsividade.
