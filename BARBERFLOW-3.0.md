# BarberFlow 3.0 — operação completa

A versão 3.0 transforma o BarberFlow em uma suíte operacional focada em barbearias. A Loja pública permanece fora da navegação e desligada por padrão; produtos continuam integrados ao PDV e estoque.

## Módulos integrados

- Comandas: abertura manual ou a partir de agendamento, serviços/produtos/extras, desconto, pagamento, estoque, fidelidade e conclusão do atendimento.
- Clube de Assinaturas: planos, franquias mensais de serviços, consumo, cobrança interna, vencimento e inadimplência.
- CRM avançado: segmentos automáticos, ticket, frequência, no-show, tags, histórico, clube e pacotes.
- Fila inteligente: preferências de data/horário/profissional e aviso por WhatsApp quando surge vaga.
- Fidelidade e pacotes: pontos, extrato, venda de pacote, saldo por serviço e validade.
- Estoque profissional: fornecedores, movimentações, compras, custo médio e insumos consumidos por serviço.
- Fiscal/NFS-e: preparação de documentos e adaptador HTTPS para provedor fiscal.
- BI gerencial: receita, ticket, no-show, conclusão, clientes novos/recorrentes, MRR, estoque, ranking de profissionais e serviços.
- Marketing inteligente: oportunidades por inatividade, aniversário, ciclo de retorno e ocupação.
- IA no WhatsApp: interpretação opcional de linguagem natural com ações limitadas pelas regras do BarberFlow e fallback para o fluxo determinístico.

## Integrações externas

### IA
Defina `OPENAI_API_KEY`. O modelo pode ser alterado em `AI_MODEL`. Sem a chave, o atendimento clássico do WhatsApp continua ativo.

### NFS-e
A preparação fiscal funciona internamente. Para emissão automática configure `NFSE_API_URL` HTTPS e, quando exigido pelo provedor, `NFSE_API_TOKEN`, além das credenciais/certificado fiscal da empresa no integrador escolhido.

### Loja legada
A vitrine/e-commerce continua preservada no código, porém desativada por padrão com `ENABLE_PUBLIC_STORE=false`.

## Banco
`ensureAdvancedOpsSchema()` é executado no boot e no migrador, usando `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS`, sem apagar dados existentes.

## Validação desta entrega
- `npm run check`: 131 arquivos JavaScript validados.
- `npm test`: 178/178 testes aprovados.
- `npm run audit:security`: 0 falhas e 0 avisos.
- `npm audit --omit=dev --audit-level=high`: não concluiu neste ambiente por indisponibilidade de rede/DNS para registry.npmjs.org (`EAI_AGAIN`). Execute novamente em um ambiente com acesso ao npm antes de um release público.
