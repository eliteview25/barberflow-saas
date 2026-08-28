const pool=require('../config/db');

const REVENUE_CTE=`WITH receitas AS (
  SELECT v.criado_em::date data,
         LOWER(COALESCE(NULLIF(v.forma_pagamento,''),'nao_informado')) forma_pagamento,
         COALESCE(v.total,0)::numeric valor,
         v.barbeiro_id
    FROM vendas v
   WHERE v.barbearia_id=$1 AND v.status='finalizada'
  UNION ALL
  SELECT a.data::date data,
         LOWER(COALESCE(NULLIF(a.forma_pagamento,''),'nao_informado')) forma_pagamento,
         COALESCE(a.valor_final,a.valor_servico,s.preco,0)::numeric valor,
         a.barbeiro_id
    FROM agendamentos a
    JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id
   WHERE a.barbearia_id=$1 AND a.status='concluido'
     AND NOT EXISTS (
       SELECT 1 FROM vendas v
        WHERE v.barbearia_id=a.barbearia_id
          AND v.agendamento_id=a.id
          AND v.status='finalizada'
     )
)`;

async function ensureFinanceAnalyticsSchema(db=pool){
  await db.query(`CREATE TABLE IF NOT EXISTS metas_financeiras(
    id BIGSERIAL PRIMARY KEY,
    barbearia_id INTEGER NOT NULL REFERENCES barbearias(id) ON DELETE CASCADE,
    barbeiro_id INTEGER REFERENCES barbeiros(id) ON DELETE CASCADE,
    mes DATE NOT NULL,
    valor NUMERIC(12,2) NOT NULL CHECK(valor>=0),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_meta_financeira_geral_mes ON metas_financeiras(barbearia_id,mes) WHERE barbeiro_id IS NULL`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_meta_financeira_barbeiro_mes ON metas_financeiras(barbearia_id,barbeiro_id,mes) WHERE barbeiro_id IS NOT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_metas_financeiras_tenant_mes ON metas_financeiras(barbearia_id,mes DESC)`);
}

function paymentGroupSql(field='forma_pagamento'){
  return `CASE
    WHEN ${field} IN ('pix','pix_manual') THEN 'pix'
    WHEN ${field} IN ('cartao','credito','debito','credit_card','debit_card','prepaid_card') THEN 'cartao'
    WHEN ${field}='dinheiro' THEN 'dinheiro'
    WHEN ${field}='mercado_pago' THEN 'mercado_pago'
    ELSE 'outros' END`;
}

async function financialEntries(barbeariaId,inicio=null,fim=null){
  const r=await pool.query(`
    SELECT * FROM (
      SELECT v.id,v.criado_em::date data,
             COALESCE(c.nome,'Venda no balcão') cliente,
             COALESCE(br.nome,'-') barbeiro,
             COALESCE(s.nome,CASE WHEN COALESCE(v.subtotal_servicos,0)>0 THEN 'Venda / PDV' ELSE 'Produtos / PDV' END) servico,
             COALESCE(v.total,0)::numeric preco,
             LOWER(COALESCE(NULLIF(v.forma_pagamento,''),'nao_informado')) forma_pagamento,
             'pdv' origem
        FROM vendas v
        LEFT JOIN clientes c ON c.id=v.cliente_id AND c.barbearia_id=v.barbearia_id
        LEFT JOIN barbeiros br ON br.id=v.barbeiro_id AND br.barbearia_id=v.barbearia_id
        LEFT JOIN agendamentos a ON a.id=v.agendamento_id AND a.barbearia_id=v.barbearia_id
        LEFT JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id
       WHERE v.barbearia_id=$1 AND v.status='finalizada'
         AND ($2::date IS NULL OR v.criado_em::date >= $2::date)
         AND ($3::date IS NULL OR v.criado_em::date <= $3::date)
      UNION ALL
      SELECT a.id,a.data,c.nome,br.nome,s.nome,
             COALESCE(a.valor_final,a.valor_servico,s.preco,0)::numeric preco,
             LOWER(COALESCE(NULLIF(a.forma_pagamento,''),'nao_informado')) forma_pagamento,
             'atendimento' origem
        FROM agendamentos a
        JOIN clientes c ON c.id=a.cliente_id AND c.barbearia_id=a.barbearia_id
        JOIN barbeiros br ON br.id=a.barbeiro_id AND br.barbearia_id=a.barbearia_id
        JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id
       WHERE a.barbearia_id=$1 AND a.status='concluido'
         AND ($2::date IS NULL OR a.data >= $2::date)
         AND ($3::date IS NULL OR a.data <= $3::date)
         AND NOT EXISTS(SELECT 1 FROM vendas v WHERE v.barbearia_id=a.barbearia_id AND v.agendamento_id=a.id AND v.status='finalizada')
    ) x ORDER BY data DESC,id DESC`,[barbeariaId,inicio,fim]);
  const total=r.rows.reduce((sum,x)=>sum+Number(x.preco||0),0);
  return {itens:r.rows,total,quantidade:r.rowCount,ticket_medio:r.rowCount?total/r.rowCount:0};
}

async function rankingForMonth(barbeariaId,monthStart){
  const r=await pool.query(`WITH ranking_src AS (
    SELECT v.barbeiro_id,
           COALESCE(v.total,0)::numeric valor,
           (COALESCE(v.subtotal_servicos,0)*COALESCE(br.comissao_servico_pct,0)/100
            +COALESCE(v.subtotal_produtos,0)*COALESCE(br.comissao_produto_pct,0)/100)::numeric comissao
      FROM vendas v
      JOIN barbeiros br ON br.id=v.barbeiro_id AND br.barbearia_id=v.barbearia_id
     WHERE v.barbearia_id=$1 AND v.status='finalizada'
       AND v.criado_em::date >= $2::date AND v.criado_em::date < ($2::date+INTERVAL '1 month')
    UNION ALL
    SELECT a.barbeiro_id,
           COALESCE(a.valor_final,a.valor_servico,s.preco,0)::numeric valor,
           (COALESCE(a.valor_final,a.valor_servico,s.preco,0)*COALESCE(br.comissao_servico_pct,0)/100)::numeric comissao
      FROM agendamentos a
      JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id
      JOIN barbeiros br ON br.id=a.barbeiro_id AND br.barbearia_id=a.barbearia_id
     WHERE a.barbearia_id=$1 AND a.status='concluido'
       AND a.data >= $2::date AND a.data < ($2::date+INTERVAL '1 month')
       AND NOT EXISTS(SELECT 1 FROM vendas v WHERE v.barbearia_id=a.barbearia_id AND v.agendamento_id=a.id AND v.status='finalizada')
  )
  SELECT br.id,br.nome,COALESCE(SUM(rs.valor),0)::numeric total,
         COALESCE(SUM(rs.comissao),0)::numeric comissao_estimada,
         COUNT(rs.barbeiro_id)::int atendimentos
    FROM barbeiros br
    LEFT JOIN ranking_src rs ON rs.barbeiro_id=br.id
   WHERE br.barbearia_id=$1 AND br.ativo=true
   GROUP BY br.id,br.nome
   ORDER BY total DESC,br.nome`,[barbeariaId,monthStart]);
  return r.rows;
}

async function financialCharts(barbeariaId){
  const monthStart=(await pool.query(`SELECT date_trunc('month',CURRENT_DATE)::date mes`)).rows[0].mes;
  const [mensal,formas,barbeiros]=await Promise.all([
    pool.query(`${REVENUE_CTE}, meses AS (
      SELECT generate_series(date_trunc('month',CURRENT_DATE)-INTERVAL '5 months',date_trunc('month',CURRENT_DATE),INTERVAL '1 month') mes
    ) SELECT to_char(m.mes,'YYYY-MM') mes,COALESCE(SUM(r.valor),0)::numeric total,COUNT(r.data)::int atendimentos
        FROM meses m LEFT JOIN receitas r ON date_trunc('month',r.data)::date=m.mes::date
       GROUP BY m.mes ORDER BY m.mes`,[barbeariaId]),
    pool.query(`${REVENUE_CTE} SELECT ${paymentGroupSql()} metodo,COALESCE(SUM(valor),0)::numeric total,COUNT(*)::int quantidade
      FROM receitas WHERE date_trunc('month',data)=date_trunc('month',CURRENT_DATE)
      GROUP BY 1 ORDER BY total DESC`,[barbeariaId]),
    rankingForMonth(barbeariaId,monthStart)
  ]);
  const pix=formas.rows.find(x=>x.metodo==='pix')||{total:0,quantidade:0};
  return {mensal:mensal.rows,formas:formas.rows,barbeiros,pix:{total:Number(pix.total||0),quantidade:Number(pix.quantidade||0)}};
}

async function series(barbeariaId,grain){
  const defs={
    diario:{start:"CURRENT_DATE-6",end:'CURRENT_DATE',step:"INTERVAL '1 day'",match:'r.data=p.inicio::date',label:"to_char(p.inicio,'DD/MM')"},
    semanal:{start:"date_trunc('week',CURRENT_DATE)-INTERVAL '7 weeks'",end:"date_trunc('week',CURRENT_DATE)",step:"INTERVAL '1 week'",match:"date_trunc('week',r.data)::date=p.inicio::date",label:"'S' || to_char(p.inicio,'WW')"},
    mensal:{start:"date_trunc('month',CURRENT_DATE)-INTERVAL '11 months'",end:"date_trunc('month',CURRENT_DATE)",step:"INTERVAL '1 month'",match:"date_trunc('month',r.data)::date=p.inicio::date",label:"to_char(p.inicio,'Mon')"},
    anual:{start:"date_trunc('year',CURRENT_DATE)-INTERVAL '4 years'",end:"date_trunc('year',CURRENT_DATE)",step:"INTERVAL '1 year'",match:"date_trunc('year',r.data)::date=p.inicio::date",label:"to_char(p.inicio,'YYYY')"}
  };
  const d=defs[grain];if(!d)return [];
  const q=await pool.query(`${REVENUE_CTE}, periodos AS (SELECT generate_series(${d.start},${d.end},${d.step}) inicio)
    SELECT ${d.label} label,p.inicio::date periodo,COALESCE(SUM(r.valor),0)::numeric total
      FROM periodos p LEFT JOIN receitas r ON ${d.match}
     GROUP BY p.inicio ORDER BY p.inicio`,[barbeariaId]);
  return q.rows;
}

async function dashboardRevenue(barbeariaId){
  const [totais,diario,semanal,mensal,anual]=await Promise.all([
    pool.query(`${REVENUE_CTE} SELECT
      COALESCE(SUM(valor) FILTER(WHERE data=CURRENT_DATE),0)::numeric hoje,
      COALESCE(SUM(valor) FILTER(WHERE data>=date_trunc('week',CURRENT_DATE)::date AND data<CURRENT_DATE+1),0)::numeric semana,
      COALESCE(SUM(valor) FILTER(WHERE date_trunc('month',data)=date_trunc('month',CURRENT_DATE)),0)::numeric mes,
      COALESCE(SUM(valor) FILTER(WHERE date_trunc('year',data)=date_trunc('year',CURRENT_DATE)),0)::numeric ano
      FROM receitas`,[barbeariaId]),
    series(barbeariaId,'diario'),series(barbeariaId,'semanal'),series(barbeariaId,'mensal'),series(barbeariaId,'anual')
  ]);
  return {totais:totais.rows[0],series:{diario,semanal,mensal,anual}};
}

async function goalsForMonth(barbeariaId,monthStart){
  await ensureFinanceAnalyticsSchema();
  const [metaRows,barbeiros]=await Promise.all([
    pool.query(`SELECT barbeiro_id,valor FROM metas_financeiras WHERE barbearia_id=$1 AND mes=$2::date`,[barbeariaId,monthStart]),
    rankingForMonth(barbeariaId,monthStart)
  ]);
  const geral=metaRows.rows.find(x=>x.barbeiro_id===null);
  const byId=new Map(metaRows.rows.filter(x=>x.barbeiro_id!==null).map(x=>[Number(x.barbeiro_id),Number(x.valor||0)]));
  const total=barbeiros.reduce((s,x)=>s+Number(x.total||0),0),metaGeral=Number(geral?.valor||0);
  return {
    mes:String(monthStart).slice(0,10),
    geral:{meta:metaGeral,realizado:total,percentual:metaGeral>0?Math.min(999,Math.round(total/metaGeral*100)):0},
    barbeiros:barbeiros.map(x=>{const meta=byId.get(Number(x.id))||0,realizado=Number(x.total||0);return {...x,meta,realizado,percentual:meta>0?Math.min(999,Math.round(realizado/meta*100)):0}})
  };
}

async function saveGoals(barbeariaId,monthStart,metaGeral,barberGoals){
  await ensureFinanceAnalyticsSchema();const db=await pool.connect();
  try{
    await db.query('BEGIN');
    if(metaGeral>0)await db.query(`INSERT INTO metas_financeiras(barbearia_id,barbeiro_id,mes,valor) VALUES($1,NULL,$2::date,$3)
      ON CONFLICT(barbearia_id,mes) WHERE barbeiro_id IS NULL DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=NOW()`,[barbeariaId,monthStart,metaGeral]);
    else await db.query(`DELETE FROM metas_financeiras WHERE barbearia_id=$1 AND mes=$2::date AND barbeiro_id IS NULL`,[barbeariaId,monthStart]);
    for(const item of barberGoals){
      const valid=await db.query(`SELECT 1 FROM barbeiros WHERE id=$1 AND barbearia_id=$2`,[item.barbeiro_id,barbeariaId]);
      if(!valid.rowCount)throw new Error('Barbeiro inválido');
      if(item.valor>0)await db.query(`INSERT INTO metas_financeiras(barbearia_id,barbeiro_id,mes,valor) VALUES($1,$2,$3::date,$4)
        ON CONFLICT(barbearia_id,barbeiro_id,mes) WHERE barbeiro_id IS NOT NULL DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=NOW()`,[barbeariaId,item.barbeiro_id,monthStart,item.valor]);
      else await db.query(`DELETE FROM metas_financeiras WHERE barbearia_id=$1 AND barbeiro_id=$2 AND mes=$3::date`,[barbeariaId,item.barbeiro_id,monthStart]);
    }
    await db.query('COMMIT');return goalsForMonth(barbeariaId,monthStart);
  }catch(e){try{await db.query('ROLLBACK')}catch{}throw e}finally{db.release()}
}

module.exports={ensureFinanceAnalyticsSchema,financialEntries,financialCharts,dashboardRevenue,goalsForMonth,saveGoals,paymentGroupSql,REVENUE_CTE};
