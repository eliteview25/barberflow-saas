const express=require('express');
const pool=require('../config/db');
const {autenticar,exigirPapel}=require('../middlewares/auth');
const router=express.Router();
router.use(autenticar,exigirPapel('super_admin'));

const PLANOS={
  starter:Number(process.env.PLAN_STARTER_PRICE||39.90),
  pro:Number(process.env.PLAN_PRO_PRICE||69.90),
  premium:Number(process.env.PLAN_PREMIUM_PRICE||119.90)
};
function mensalidade(plano){return PLANOS[plano]||0}

router.get('/dashboard',async(req,res)=>{
  try{
    const resumo=await pool.query(`
      WITH ult AS (
        SELECT DISTINCT ON (barbearia_id) barbearia_id,plano,status,fim_trial,proxima_cobranca
        FROM assinaturas ORDER BY barbearia_id,id DESC
      )
      SELECT
        (SELECT COUNT(*) FROM barbearias)::int AS barbearias_total,
        (SELECT COUNT(*) FROM barbearias WHERE ativo=true)::int AS barbearias_ativas,
        (SELECT COUNT(*) FROM ult WHERE status='trial')::int AS trials,
        (SELECT COUNT(*) FROM ult WHERE status='ativa')::int AS assinaturas_ativas,
        (SELECT COUNT(*) FROM ult WHERE status IN ('inadimplente','atrasada'))::int AS inadimplentes,
        (SELECT COUNT(*) FROM ult WHERE status='cancelada')::int AS canceladas,
        (SELECT COUNT(*) FROM agendamentos WHERE date_trunc('month',data)=date_trunc('month',CURRENT_DATE))::int AS agendamentos_mes,
        (SELECT COUNT(*) FROM clientes)::int AS clientes_total
    `);
    const planos=await pool.query(`SELECT plano,COUNT(*)::int quantidade FROM (SELECT DISTINCT ON (barbearia_id) barbearia_id,plano,status FROM assinaturas ORDER BY barbearia_id,id DESC) x WHERE status='ativa' GROUP BY plano`);
    const mrr=planos.rows.reduce((s,x)=>s+mensalidade(x.plano)*Number(x.quantidade),0);
    const recentes=await pool.query(`
      SELECT b.id,b.nome,b.slug,b.ativo,b.criado_em,u.nome dono,u.email,
             a.plano,a.status,a.fim_trial,a.proxima_cobranca,
             (SELECT COUNT(*) FROM agendamentos ag WHERE ag.barbearia_id=b.id AND ag.data>=CURRENT_DATE-INTERVAL '30 days')::int agendamentos_30d
      FROM barbearias b
      LEFT JOIN LATERAL (SELECT nome,email FROM usuarios WHERE barbearia_id=b.id AND papel='dono' ORDER BY id LIMIT 1) u ON true
      LEFT JOIN LATERAL (SELECT plano,status,fim_trial,proxima_cobranca FROM assinaturas WHERE barbearia_id=b.id ORDER BY id DESC LIMIT 1) a ON true
      ORDER BY b.criado_em DESC LIMIT 8
    `);
    res.json({resumo:{...resumo.rows[0],mrr},planos:planos.rows,recentes:recentes.rows});
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar Dashboard Master'});}
});

router.get('/barbearias',async(req,res)=>{
  try{
    const busca=String(req.query.busca||'').trim();
    const status=String(req.query.status||'').trim();
    const vals=[];const where=[];
    if(busca){vals.push(`%${busca}%`);where.push(`(b.nome ILIKE $${vals.length} OR b.slug ILIKE $${vals.length} OR u.email ILIKE $${vals.length})`)}
    if(status){vals.push(status);where.push(`a.status=$${vals.length}`)}
    const r=await pool.query(`
      SELECT b.id,b.nome,b.slug,b.telefone,b.email,b.cidade,b.estado,b.ativo,b.criado_em,
             u.nome dono,u.email dono_email,a.plano,a.status,a.fim_trial,a.proxima_cobranca,
             (SELECT COUNT(*) FROM usuarios x WHERE x.barbearia_id=b.id AND x.ativo=true)::int usuarios,
             (SELECT COUNT(*) FROM barbeiros x WHERE x.barbearia_id=b.id AND x.ativo=true)::int barbeiros,
             (SELECT COUNT(*) FROM clientes x WHERE x.barbearia_id=b.id)::int clientes,
             (SELECT COUNT(*) FROM agendamentos x WHERE x.barbearia_id=b.id AND x.data>=CURRENT_DATE-INTERVAL '30 days')::int agendamentos_30d
      FROM barbearias b
      LEFT JOIN LATERAL (SELECT nome,email FROM usuarios WHERE barbearia_id=b.id AND papel='dono' ORDER BY id LIMIT 1) u ON true
      LEFT JOIN LATERAL (SELECT plano,status,fim_trial,proxima_cobranca FROM assinaturas WHERE barbearia_id=b.id ORDER BY id DESC LIMIT 1) a ON true
      ${where.length?'WHERE '+where.join(' AND '):''}
      ORDER BY b.criado_em DESC,b.id DESC
    `,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao listar barbearias'});}
});

router.get('/barbearias/:id',async(req,res)=>{
  try{
    const id=Number(req.params.id);
    const b=await pool.query(`SELECT * FROM barbearias WHERE id=$1`,[id]);
    if(!b.rowCount)return res.status(404).json({erro:'Barbearia não encontrada'});
    const [assinatura,usuarios,metricas]=await Promise.all([
      pool.query(`SELECT * FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[id]),
      pool.query(`SELECT id,nome,email,papel,ativo,criado_em FROM usuarios WHERE barbearia_id=$1 ORDER BY papel,nome`,[id]),
      pool.query(`SELECT
        (SELECT COUNT(*) FROM clientes WHERE barbearia_id=$1)::int clientes,
        (SELECT COUNT(*) FROM barbeiros WHERE barbearia_id=$1 AND ativo=true)::int barbeiros,
        (SELECT COUNT(*) FROM servicos WHERE barbearia_id=$1 AND ativo=true)::int servicos,
        (SELECT COUNT(*) FROM agendamentos WHERE barbearia_id=$1)::int agendamentos,
        (SELECT COUNT(*) FROM agendamentos WHERE barbearia_id=$1 AND data>=CURRENT_DATE-INTERVAL '30 days')::int agendamentos_30d,
        (SELECT COALESCE(SUM(s.preco),0) FROM agendamentos a JOIN servicos s ON s.id=a.servico_id WHERE a.barbearia_id=$1 AND a.status='concluido' AND date_trunc('month',a.data)=date_trunc('month',CURRENT_DATE)) faturamento_mes`,[id])
    ]);
    res.json({barbearia:b.rows[0],assinatura:assinatura.rows[0]||null,usuarios:usuarios.rows,metricas:metricas.rows[0]});
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar barbearia'});}
});

router.patch('/barbearias/:id/status',async(req,res)=>{
  try{const r=await pool.query(`UPDATE barbearias SET ativo=$1 WHERE id=$2 RETURNING id,nome,ativo`,[!!req.body.ativo,req.params.id]);if(!r.rowCount)return res.status(404).json({erro:'Barbearia não encontrada'});res.json(r.rows[0]);}
  catch(e){res.status(500).json({erro:'Erro ao alterar barbearia'});}
});

router.patch('/barbearias/:id/assinatura',async(req,res)=>{
  try{
    const {plano,status,fim_trial,proxima_cobranca}=req.body;
    const ultima=await pool.query(`SELECT id FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[req.params.id]);
    if(!ultima.rowCount)return res.status(404).json({erro:'Assinatura não encontrada'});
    const r=await pool.query(`UPDATE assinaturas SET plano=COALESCE($1,plano),status=COALESCE($2,status),fim_trial=COALESCE($3::date,fim_trial),proxima_cobranca=$4::date,atualizado_em=NOW() WHERE id=$5 RETURNING *`,[plano||null,status||null,fim_trial||null,proxima_cobranca||null,ultima.rows[0].id]);
    res.json(r.rows[0]);
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao atualizar assinatura'});}
});

module.exports=router;
