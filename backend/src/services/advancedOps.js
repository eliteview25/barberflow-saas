const pool=require('../config/db');
const wp=require('./whatsappProviders');
const {sendText}=require('./whatsapp');

async function ensureAdvancedOpsSchema(db=pool){
  await db.query(`CREATE TABLE IF NOT EXISTS comandas(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    barbeiro_id INTEGER REFERENCES barbeiros(id) ON DELETE SET NULL,
    agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','fechada','cancelada')),
    subtotal_servicos NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal_produtos NUMERIC(12,2) NOT NULL DEFAULT 0,
    desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    forma_pagamento VARCHAR(30),
    venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
    observacoes TEXT,
    aberta_em TIMESTAMP NOT NULL DEFAULT NOW(),
    fechada_em TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(barbearia_id,agendamento_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS comanda_itens(
    id BIGSERIAL PRIMARY KEY,
    comanda_id BIGINT NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK(tipo IN ('servico','produto','extra')),
    referencia_id INTEGER,
    descricao VARCHAR(200) NOT NULL,
    quantidade NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK(quantidade>0),
    valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(valor_unitario>=0),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS clube_planos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    descricao TEXT,
    preco_mensal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(preco_mensal>=0),
    dia_cobranca INTEGER CHECK(dia_cobranca BETWEEN 1 AND 28),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS clube_plano_servicos(
    plano_id BIGINT NOT NULL REFERENCES clube_planos(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    quantidade_mensal INTEGER NOT NULL DEFAULT 1 CHECK(quantidade_mensal BETWEEN 1 AND 100),
    PRIMARY KEY(plano_id,servico_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS clube_assinaturas(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    plano_id BIGINT NOT NULL REFERENCES clube_planos(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','pausada','inadimplente','cancelada')),
    inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    proxima_cobranca DATE,
    forma_pagamento VARCHAR(30),
    observacoes TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS clube_consumos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    assinatura_id BIGINT NOT NULL REFERENCES clube_assinaturas(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
    agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
    competencia DATE NOT NULL DEFAULT date_trunc('month',CURRENT_DATE)::date,
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>0),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await db.query(`ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS validade_dias INTEGER NOT NULL DEFAULT 90`);
  await db.query(`ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()`);
  await db.query(`CREATE TABLE IF NOT EXISTS pacote_servicos(
    pacote_id INTEGER NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade BETWEEN 1 AND 1000),
    PRIMARY KEY(pacote_id,servico_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS cliente_pacotes(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pacote_id INTEGER NOT NULL REFERENCES pacotes(id) ON DELETE RESTRICT,
    valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','consumido','expirado','cancelado')),
    comprado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    expira_em DATE,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS cliente_pacote_saldos(
    cliente_pacote_id BIGINT NOT NULL REFERENCES cliente_pacotes(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
    quantidade_total INTEGER NOT NULL CHECK(quantidade_total>=0),
    quantidade_usada INTEGER NOT NULL DEFAULT 0 CHECK(quantidade_usada>=0),
    PRIMARY KEY(cliente_pacote_id,servico_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS fidelidade_movimentos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pontos INTEGER NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    referencia_tipo VARCHAR(30),
    referencia_id BIGINT,
    descricao VARCHAR(220),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS crm_tags(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(60) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(barbearia_id,nome)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS crm_cliente_tags(
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(cliente_id,tag_id)
  )`);

  for(const [col,type] of [
    ['data_preferida','DATE'],['hora_inicio','TIME'],['hora_fim','TIME'],['prioridade','INTEGER NOT NULL DEFAULT 0'],
    ['notificado_em','TIMESTAMP'],['expira_em','TIMESTAMP'],['origem',"VARCHAR(30) NOT NULL DEFAULT 'painel'"]
  ])await db.query(`ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS ${col} ${type}`);

  await db.query(`CREATE TABLE IF NOT EXISTS fiscal_config(
    barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT false,
    provedor VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK(provedor IN ('manual','custom')),
    regime VARCHAR(40),codigo_servico VARCHAR(40),item_lista_servico VARCHAR(40),aliquota_iss NUMERIC(7,4),
    municipio_codigo VARCHAR(20),inscricao_municipal VARCHAR(60),observacoes TEXT,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS fiscal_documentos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','processando','emitida','erro','cancelada')),
    valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    descricao TEXT,numero VARCHAR(80),codigo_verificacao VARCHAR(120),url TEXT,provider_id TEXT,erro TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),emitido_em TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);


  await db.query(`CREATE TABLE IF NOT EXISTS fornecedores(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    documento VARCHAR(40),
    telefone VARCHAR(40),
    email VARCHAR(160),
    contato VARCHAR(120),
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) NOT NULL DEFAULT 'un'`);
  await db.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS validade DATE`);
  await db.query(`CREATE TABLE IF NOT EXISTS estoque_movimentos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK(tipo IN ('entrada','saida','ajuste','venda','compra','consumo_servico','estorno')),
    quantidade NUMERIC(12,3) NOT NULL,
    estoque_anterior NUMERIC(12,3) NOT NULL,
    estoque_posterior NUMERIC(12,3) NOT NULL,
    custo_unitario NUMERIC(12,4),
    referencia_tipo VARCHAR(30),
    referencia_id BIGINT,
    observacoes VARCHAR(500),
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS compras_pedidos(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','aberto','recebido','cancelado')),
    numero_documento VARCHAR(80),
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    recebido_em TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS compra_itens(
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL REFERENCES compras_pedidos(id) ON DELETE CASCADE,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade NUMERIC(12,3) NOT NULL CHECK(quantidade>0),
    custo_unitario NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK(custo_unitario>=0),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS servico_insumos(
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    quantidade NUMERIC(12,3) NOT NULL CHECK(quantidade>0),
    PRIMARY KEY(barbearia_id,servico_id,produto_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS clube_cobrancas(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    assinatura_id BIGINT NOT NULL REFERENCES clube_assinaturas(id) ON DELETE CASCADE,
    competencia DATE NOT NULL,
    vencimento DATE NOT NULL,
    valor NUMERIC(12,2) NOT NULL CHECK(valor>=0),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','paga','vencida','cancelada')),
    forma_pagamento VARCHAR(30),
    referencia_externa TEXT,
    pago_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(assinatura_id,competencia)
  )`);

  await db.query(`CREATE INDEX IF NOT EXISTS ix_comandas_tenant_status ON comandas(barbearia_id,status,aberta_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_clube_assinaturas_tenant_status ON clube_assinaturas(barbearia_id,status,atualizado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_cliente_pacotes_tenant_cliente ON cliente_pacotes(barbearia_id,cliente_id,status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_fidelidade_movimentos_tenant_cliente ON fidelidade_movimentos(barbearia_id,cliente_id,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_fila_inteligente ON fila_espera(barbearia_id,status,data_preferida,prioridade DESC,criado_em)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_fiscal_documentos_tenant ON fiscal_documentos(barbearia_id,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_fornecedores_tenant ON fornecedores(barbearia_id,ativo,nome)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_estoque_movimentos_tenant ON estoque_movimentos(barbearia_id,produto_id,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_compras_tenant ON compras_pedidos(barbearia_id,status,criado_em DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_clube_cobrancas_tenant ON clube_cobrancas(barbearia_id,status,vencimento)`);
}

async function recomputeComanda(c,id,tenant){
  const sums=(await c.query(`SELECT COALESCE(SUM(subtotal) FILTER(WHERE tipo='servico'),0)::numeric servicos,COALESCE(SUM(subtotal) FILTER(WHERE tipo='produto'),0)::numeric produtos,COALESCE(SUM(subtotal) FILTER(WHERE tipo='extra'),0)::numeric extras FROM comanda_itens WHERE comanda_id=$1 AND barbearia_id=$2`,[id,tenant])).rows[0];
  const cmd=(await c.query(`SELECT desconto FROM comandas WHERE id=$1 AND barbearia_id=$2`,[id,tenant])).rows[0];
  const serv=Number(sums.servicos||0)+Number(sums.extras||0),prod=Number(sums.produtos||0),des=Math.max(0,Number(cmd?.desconto||0)),total=Math.max(0,serv+prod-des);
  await c.query(`UPDATE comandas SET subtotal_servicos=$1,subtotal_produtos=$2,total=$3,atualizado_em=NOW() WHERE id=$4 AND barbearia_id=$5`,[serv,prod,total,id,tenant]);
  return {subtotal_servicos:serv,subtotal_produtos:prod,desconto:des,total};
}


async function recordStockMovement(c,{barbeariaId,produtoId,tipo,quantidade,estoqueAnterior,estoquePosterior,custoUnitario=null,referenciaTipo=null,referenciaId=null,observacoes=null,usuarioId=null}){
  await c.query(`INSERT INTO estoque_movimentos(barbearia_id,produto_id,tipo,quantidade,estoque_anterior,estoque_posterior,custo_unitario,referencia_tipo,referencia_id,observacoes,criado_por)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [barbeariaId,produtoId,tipo,quantidade,estoqueAnterior,estoquePosterior,custoUnitario,referenciaTipo,referenciaId,observacoes,usuarioId]);
}
async function consumeServiceInputs(c,{barbeariaId,serviceItems,referenceType='venda',referenceId=null,usuarioId=null}){
  for(const item of serviceItems||[]){
    if(!item.referencia_id)continue;
    const inputs=(await c.query(`SELECT si.produto_id,si.quantidade,p.nome,p.estoque,p.custo
      FROM servico_insumos si JOIN produtos p ON p.id=si.produto_id AND p.barbearia_id=si.barbearia_id
      WHERE si.barbearia_id=$1 AND si.servico_id=$2 FOR UPDATE OF p`,[barbeariaId,item.referencia_id])).rows;
    for(const input of inputs){
      const qty=Number(input.quantidade)*Number(item.quantidade||1);
      const before=Number(input.estoque||0),after=Number((before-qty).toFixed(3));
      if(after<0)throw new Error(`Estoque insuficiente do insumo ${input.nome}`);
      await c.query(`UPDATE produtos SET estoque=$1,atualizado_em=NOW() WHERE id=$2 AND barbearia_id=$3`,[after,input.produto_id,barbeariaId]);
      await recordStockMovement(c,{barbeariaId,produtoId:input.produto_id,tipo:'consumo_servico',quantidade:-qty,estoqueAnterior:before,estoquePosterior:after,custoUnitario:Number(input.custo||0),referenciaTipo:referenceType,referenciaId,observacoes:`Consumo automático do serviço ${item.descricao||item.referencia_id}`,usuarioId});
    }
  }
}

async function notifyWaitlistForSlot({barbeariaId,barbeiroId=null,servicoId=null,data=null,horario=null}){
  try{
    const connection=await wp.activeConnection(barbeariaId);if(!connection)return 0;
    const vals=[barbeariaId],where=[`f.barbearia_id=$1`,`f.status='aguardando'`];
    if(servicoId){vals.push(servicoId);where.push(`f.servico_id=$${vals.length}`)}
    if(barbeiroId){vals.push(barbeiroId);where.push(`(f.barbeiro_id IS NULL OR f.barbeiro_id=$${vals.length})`)}
    if(data){vals.push(data);where.push(`(f.data_preferida IS NULL OR f.data_preferida=$${vals.length})`)}
    if(horario){vals.push(horario);where.push(`(f.hora_inicio IS NULL OR f.hora_inicio<=$${vals.length}::time) AND (f.hora_fim IS NULL OR f.hora_fim>=$${vals.length}::time)`)}
    const rows=(await pool.query(`SELECT f.id,c.nome,c.telefone,s.nome servico FROM fila_espera f JOIN clientes c ON c.id=f.cliente_id AND c.barbearia_id=f.barbearia_id JOIN servicos s ON s.id=f.servico_id AND s.barbearia_id=f.barbearia_id WHERE ${where.join(' AND ')} ORDER BY f.prioridade DESC,f.criado_em LIMIT 5`,vals)).rows;
    let sent=0;for(const x of rows){try{await sendText(connection,x.telefone,`Olá, ${x.nome}! Surgiu um horário para ${x.servico}${data?` em ${String(data).split('-').reverse().join('/')}`:''}${horario?` às ${String(horario).slice(0,5)}`:''}. Responda *oi* para agendar antes que a vaga seja ocupada.`);await pool.query(`UPDATE fila_espera SET status='notificado',notificado_em=NOW(),atualizado_em=NOW() WHERE id=$1 AND barbearia_id=$2`,[x.id,barbeariaId]);sent++;}catch(e){console.error('waitlist_notify_failed',x.id,e.message)}}return sent;
  }catch(e){console.error('waitlist_notify',e.message);return 0}
}

module.exports={ensureAdvancedOpsSchema,recomputeComanda,notifyWaitlistForSlot,recordStockMovement,consumeServiceInputs};
