const express=require('express');
const bcrypt=require('bcryptjs');
const pool=require('../config/db');
const {autenticar,exigirPapel,exigirStepUp}=require('../middlewares/auth');
const {decrypt}=require('../services/secrets');
const {verifyAndConsumeTotp}=require('../services/accountSecurity');
const {atualizarValorAssinatura,atualizarStatusAssinatura,precoPlano}=require('../services/mercadoPago');
const {strongPassword,validEmail,normalizePhone,publicError}=require('../utils/security');
const {intId,cleanText,isoDate}=require('../utils/validation');
const {audit}=require('../services/audit');
const {PROVIDERS}=require('../services/paymentGateways');
const {listPlatformGateways,savePlatformGatewayCredentials,disconnectPlatformGateway}=require('../services/platformPaymentGateways');
const {getSupportSettings,setPlatformSetting}=require('../services/platformSettings');
const {ensureTenantLifecycleSchema,purgeTenantPermanent,purgeExpiredTenants}=require('../services/tenantLifecycle');
const {notificar}=require('../services/notifications');
const router=express.Router();
router.use(autenticar,exigirPapel('super_admin'));

function mensalidade(plano,ciclo='mensal'){try{const valor=precoPlano(plano,ciclo);return ciclo==='anual'?valor/12:valor}catch{return 0}}
function validarPlano(p){return ['starter','pro','premium'].includes(p)}
function validarStatus(s){return ['trial','ativa','inadimplente','atrasada','cancelada'].includes(s)}
async function cancelarCobrancaAntesDeExcluir(id){const ext=(await pool.query(`SELECT provedor,referencia_externa,status FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[id])).rows[0];if(ext?.provedor==='mercadopago'&&ext.referencia_externa&&ext.status!=='cancelada')await atualizarStatusAssinatura(ext.referencia_externa,'canceled');}
async function exigir2FAExclusao(req,res,next){try{const row=(await pool.query(`SELECT COALESCE(mfa_enabled,false) mfa_enabled,mfa_secret_enc FROM usuarios WHERE id=$1 AND papel='super_admin'`,[req.usuario.id])).rows[0];if(!row?.mfa_enabled||!row.mfa_secret_enc)return res.status(403).json({erro:'Ative o 2FA do Supermaster antes de excluir barbearias',mfa_required:true});let secret;try{secret=decrypt(row.mfa_secret_enc)}catch{return res.status(503).json({erro:'2FA indisponível no momento'})}if(!(await verifyAndConsumeTotp(req.usuario.id,secret,req.body?.mfa_code)))return res.status(400).json({erro:'Código 2FA inválido'});next()}catch(e){console.error('master_delete_mfa',e.message);res.status(500).json({erro:'Não foi possível validar o 2FA'})}}

router.get('/dashboard',async(req,res)=>{
  try{
    const resumo=await pool.query(`
      WITH ult AS (
        SELECT DISTINCT ON (barbearia_id) barbearia_id,plano,status,fim_trial,proxima_cobranca,COALESCE(ciclo_cobranca,'mensal') ciclo_cobranca
        FROM assinaturas ORDER BY barbearia_id,id DESC
      )
      SELECT
        (SELECT COUNT(*) FROM barbearias WHERE COALESCE(is_system,false)=false AND excluido_em IS NULL)::int AS barbearias_total,
        (SELECT COUNT(*) FROM barbearias WHERE COALESCE(is_system,false)=false AND ativo=true AND excluido_em IS NULL)::int AS barbearias_ativas,
        (SELECT COUNT(*) FROM ult u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.status='trial' AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS trials,
        (SELECT COUNT(*) FROM ult u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.status='ativa' AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS assinaturas_ativas,
        (SELECT COUNT(*) FROM ult u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.status IN ('inadimplente','atrasada') AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS inadimplentes,
        (SELECT COUNT(*) FROM ult u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.status='cancelada' AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS canceladas,
        (SELECT COUNT(*) FROM agendamentos a JOIN barbearias b ON b.id=a.barbearia_id WHERE date_trunc('month',a.data)=date_trunc('month',CURRENT_DATE) AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS agendamentos_mes,
        (SELECT COUNT(*) FROM clientes c JOIN barbearias b ON b.id=c.barbearia_id WHERE COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL)::int AS clientes_total
    `);
    const ciclos=await pool.query(`SELECT plano,COALESCE(ciclo_cobranca,'mensal') ciclo,COUNT(*)::int quantidade FROM (SELECT DISTINCT ON (a.barbearia_id) a.barbearia_id,a.plano,a.status,a.ciclo_cobranca FROM assinaturas a JOIN barbearias b ON b.id=a.barbearia_id WHERE COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL ORDER BY a.barbearia_id,a.id DESC) x WHERE status='ativa' GROUP BY plano,COALESCE(ciclo_cobranca,'mensal')`);
    const grupos={};for(const x of ciclos.rows){grupos[x.plano]??={plano:x.plano,quantidade:0,mrr:0};grupos[x.plano].quantidade+=Number(x.quantidade);grupos[x.plano].mrr+=mensalidade(x.plano,x.ciclo)*Number(x.quantidade)}const planos=Object.values(grupos);
    const mrr=planos.reduce((s,x)=>s+Number(x.mrr||0),0);
    const recentes=await pool.query(`
      SELECT b.id,b.nome,b.slug,b.ativo,b.criado_em,u.nome dono,u.email,
             a.plano,a.status,a.fim_trial,a.proxima_cobranca,
             (SELECT COUNT(*) FROM agendamentos ag WHERE ag.barbearia_id=b.id AND ag.data>=CURRENT_DATE-INTERVAL '30 days')::int agendamentos_30d
      FROM barbearias b
      LEFT JOIN LATERAL (SELECT nome,email FROM usuarios WHERE barbearia_id=b.id AND papel='dono' ORDER BY id LIMIT 1) u ON true
      LEFT JOIN LATERAL (SELECT plano,status,fim_trial,proxima_cobranca FROM assinaturas WHERE barbearia_id=b.id ORDER BY id DESC LIMIT 1) a ON true
      WHERE COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL
      ORDER BY b.criado_em DESC LIMIT 8
    `);
    res.json({resumo:{...resumo.rows[0],mrr},planos,recentes:recentes.rows});
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar Dashboard Master'});}
});

router.get('/financeiro',async(req,res)=>{
  try{
    const clampMeses=v=>{const n=Number(v);return Number.isFinite(n)?Math.min(Math.max(Math.trunc(n),1),36):12};
    const mesesPassados=clampMeses(req.query.passados||12);
    const mesesFuturos=clampMeses(req.query.futuros||12);
    const cobrancas=await pool.query(`
      SELECT date_trunc('month',COALESCE(ac.pago_em,ac.vencimento,ac.competencia))::date mes,
             COALESCE(SUM(ac.valor) FILTER (WHERE ac.status='pago'),0)::numeric realizado,
             COALESCE(SUM(ac.valor) FILTER (WHERE ac.status IN ('pendente','atrasado')),0)::numeric em_aberto
      FROM assinaturas_cobrancas ac JOIN barbearias bb ON bb.id=ac.barbearia_id
      WHERE COALESCE(bb.is_system,false)=false AND COALESCE(ac.pago_em,ac.vencimento,ac.competencia)>=date_trunc('month',CURRENT_DATE)-(($1::int-1)||' months')::interval
      GROUP BY 1 ORDER BY 1
    `,[mesesPassados]);
    const atuais=await pool.query(`
      SELECT a.barbearia_id,a.plano,a.status,a.fim_trial,a.proxima_cobranca,COALESCE(a.ciclo_cobranca,'mensal') ciclo_cobranca,b.nome
      FROM assinaturas a
      JOIN barbearias b ON b.id=a.barbearia_id
      WHERE a.id=(SELECT id FROM assinaturas x WHERE x.barbearia_id=a.barbearia_id ORDER BY id DESC LIMIT 1)
        AND COALESCE(b.is_system,false)=false AND b.excluido_em IS NULL AND b.ativo=true
        AND a.status IN ('ativa','trial')
    `);
    const cobrancasStatus=await pool.query(`SELECT status,COUNT(*)::int quantidade,COALESCE(SUM(valor),0)::numeric total FROM assinaturas_cobrancas ac JOIN barbearias bb ON bb.id=ac.barbearia_id WHERE COALESCE(bb.is_system,false)=false AND ac.competencia>=date_trunc('month',CURRENT_DATE)-INTERVAL '11 months' GROUP BY status ORDER BY status`);
    const historico=[];
    for(let i=mesesPassados-1;i>=0;i--){
      const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
      const key=d.toISOString().slice(0,7);
      const r=cobrancas.rows.find(x=>String(x.mes).slice(0,7)===key);
      historico.push({periodo:key,realizado:Number(r?.realizado||0),em_aberto:Number(r?.em_aberto||0)});
    }
    const futuro=[];
    for(let i=0;i<mesesFuturos;i++){
      const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+i);
      let projetado=0;let assinaturas=0;
      for(const a of atuais.rows){
        const valor=mensalidade(a.plano,a.ciclo_cobranca);
        if(!valor)continue;
        if(a.status==='ativa'){projetado+=valor;assinaturas++;continue;}
        if(a.status==='trial'){
          const fim=a.fim_trial?new Date(a.fim_trial):null;
          const fimMes=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
          if(!fim || fim<=fimMes){projetado+=valor;assinaturas++;}
        }
      }
      futuro.push({periodo:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,projetado,assinaturas});
    }
    const mesAtual=historico[historico.length-1]||{realizado:0,em_aberto:0};
    const mrr=atuais.rows.filter(x=>x.status==='ativa').reduce((s,x)=>s+mensalidade(x.plano,x.ciclo_cobranca),0);
    const projetado12=futuro.slice(0,12).reduce((s,x)=>s+x.projetado,0);
    const realizado12=historico.slice(-12).reduce((s,x)=>s+x.realizado,0);
    const planosMix=['starter','pro','premium'].map(plano=>{const rows=atuais.rows.filter(x=>x.status==='ativa'&&x.plano===plano);return {plano,quantidade:rows.length,mrr:rows.reduce((s,x)=>s+mensalidade(plano,x.ciclo_cobranca),0)};});
    res.json({
      resumo:{mrr,arr:mrr*12,realizado_mes:mesAtual.realizado,em_aberto:mesAtual.em_aberto,realizado_12m:realizado12,projetado_12m:projetado12},
      historico,futuro,planos:planosMix,cobrancas_status:cobrancasStatus.rows.map(x=>({...x,total:Number(x.total||0)})),
      aviso_historico:'O realizado considera cobranças registradas pelo BarberFlow a partir desta atualização; períodos anteriores sem registro permanecem zerados.'
    });
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar financeiro do SaaS'});}
});

router.get('/barbearias',async(req,res)=>{
  try{
    await purgeExpiredTenants();
    const busca=String(req.query.busca||'').trim().slice(0,120);
    const status=String(req.query.status||'').trim();if(status&&!['trial','ativa','inadimplente','atrasada','cancelada','excluida'].includes(status))return res.status(400).json({erro:'Filtro de status inválido'});
    const vals=[];const where=[`COALESCE(b.is_system,false)=false`];
    if(busca){vals.push(`%${busca}%`);where.push(`(b.nome ILIKE $${vals.length} OR b.slug ILIKE $${vals.length} OR u.email ILIKE $${vals.length})`)}
    if(status==='excluida')where.push(`b.excluido_em IS NOT NULL`);else{where.push(`b.excluido_em IS NULL`);if(status){vals.push(status);where.push(`a.status=$${vals.length}`)}}
    const r=await pool.query(`
      SELECT b.id,b.nome,b.slug,b.telefone,b.email,b.cidade,b.estado,b.ativo,b.criado_em,b.excluido_em,b.exclusao_programada_em,
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
    const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Barbearia inválida'});
    const b=await pool.query(`SELECT * FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false`,[id]);
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
        (SELECT COALESCE(SUM(COALESCE(a.valor_final,a.valor_servico,s.preco)),0) FROM agendamentos a JOIN servicos s ON s.id=a.servico_id AND s.barbearia_id=a.barbearia_id WHERE a.barbearia_id=$1 AND a.status='concluido' AND date_trunc('month',a.data)=date_trunc('month',CURRENT_DATE)) faturamento_mes`,[id])
    ]);
    res.json({barbearia:b.rows[0],assinatura:assinatura.rows[0]||null,usuarios:usuarios.rows,metricas:metricas.rows[0]});
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar barbearia'});}
});

router.patch('/barbearias/:id/status',exigirStepUp,async(req,res)=>{
  try{const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Barbearia inválida'});const r=await pool.query(`UPDATE barbearias SET ativo=$1 WHERE id=$2 AND COALESCE(is_system,false)=false AND excluido_em IS NULL RETURNING id,nome,ativo`,[!!req.body.ativo,id]);if(!r.rowCount)return res.status(404).json({erro:'Barbearia não encontrada'});await audit(req,{acao:r.rows[0].ativo?'master.barbearia.ativada':'master.barbearia.bloqueada',barbeariaId:id,alvoTipo:'barbearia',alvoId:id,detalhes:{nome:r.rows[0].nome}});res.json(r.rows[0]);}
  catch(e){res.status(500).json({erro:'Erro ao alterar barbearia'});}
});

router.delete('/barbearias/:id',exigir2FAExclusao,async(req,res)=>{
  const id=intId(req.params.id);
  if(!id)return res.status(400).json({erro:'Barbearia inválida'});
  try{
    await ensureTenantLifecycleSchema();
    const pre=(await pool.query(`SELECT id,nome,excluido_em FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false`,[id])).rows[0];
    if(!pre)return res.status(404).json({erro:'Barbearia não encontrada'});if(pre.excluido_em)return res.status(409).json({erro:'Barbearia já está na lixeira'});
    try{await cancelarCobrancaAntesDeExcluir(id)}catch(e){console.error('cancel_subscription_before_delete',e.providerCode||e.status||'provider_error');return res.status(502).json({erro:'Não foi possível cancelar a cobrança recorrente. A barbearia não foi excluída.'})}
    const c=await pool.connect();try{await c.query('BEGIN');const b=(await c.query(`SELECT id,nome,excluido_em FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false FOR UPDATE`,[id])).rows[0];if(!b){await c.query('ROLLBACK');return res.status(404).json({erro:'Barbearia não encontrada'})}if(b.excluido_em){await c.query('ROLLBACK');return res.status(409).json({erro:'Barbearia já está na lixeira'})}await c.query(`UPDATE barbearias SET ativo=false,excluido_em=NOW(),exclusao_programada_em=NOW()+INTERVAL '30 days',excluida_por=$2 WHERE id=$1`,[id,req.usuario.id]);await c.query(`UPDATE usuarios SET desativado_por_exclusao=true,ativo=false WHERE barbearia_id=$1 AND papel<>'super_admin' AND ativo=true`,[id]);await c.query(`UPDATE assinaturas SET status_antes_exclusao=status,status='cancelada',provedor_status=CASE WHEN provedor='mercadopago' THEN 'canceled' ELSE provedor_status END,atualizado_em=NOW() WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1)`,[id]);await audit(req,{acao:'master.barbearia.excluida',barbeariaId:id,alvoTipo:'barbearia',alvoId:id,detalhes:{nome:b.nome,retencao_dias:30,exclusao_permanente:false}},c);await c.query('COMMIT');res.json({mensagem:'Barbearia enviada para a lixeira por 30 dias.',exclusao_em_dias:30});}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao excluir barbearia'})}
});

router.delete('/barbearias/:id/permanente',exigir2FAExclusao,async(req,res)=>{
  const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Barbearia inválida'});
  try{const pre=(await pool.query(`SELECT id,nome FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false`,[id])).rows[0];if(!pre)return res.status(404).json({erro:'Barbearia não encontrada'});try{await cancelarCobrancaAntesDeExcluir(id)}catch(e){return res.status(502).json({erro:'Não foi possível cancelar a cobrança recorrente. A exclusão permanente foi interrompida.'})}const out=await purgeTenantPermanent(id);if(!out)return res.status(404).json({erro:'Barbearia não encontrada'});await audit(req,{acao:'master.barbearia.excluida_permanente',barbeariaId:null,alvoTipo:'barbearia',alvoId:id,detalhes:{nome:pre.nome,exclusao_permanente:true}}).catch(e=>console.error('audit_permanent_tenant_delete',e.message));res.json({mensagem:'Barbearia e dados relacionados excluídos permanentemente.'});}catch(e){console.error('permanent_tenant_delete',e);res.status(500).json({erro:'Erro ao excluir permanentemente a barbearia'})}
});

router.post('/barbearias/:id/restaurar',exigirStepUp,async(req,res)=>{const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Barbearia inválida'});const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query(`UPDATE barbearias SET ativo=true,excluido_em=NULL,exclusao_programada_em=NULL,excluida_por=NULL WHERE id=$1 AND COALESCE(is_system,false)=false AND (exclusao_programada_em IS NULL OR exclusao_programada_em>NOW()) RETURNING id,nome,ativo`,[id]);if(!r.rowCount){await c.query('ROLLBACK');return res.status(404).json({erro:'Barbearia não encontrada ou prazo de recuperação expirado'})}await c.query(`UPDATE usuarios SET ativo=true,desativado_por_exclusao=false WHERE barbearia_id=$1 AND desativado_por_exclusao=true AND papel<>'super_admin'`,[id]);await audit(req,{acao:'master.barbearia.restaurada',barbeariaId:id,alvoTipo:'barbearia',alvoId:id,detalhes:{nome:r.rows[0].nome}},c);await c.query('COMMIT');res.json({...r.rows[0],assinatura_reativacao_necessaria:true,mensagem:'Barbearia restaurada. Reative a assinatura antes de liberar cobrança recorrente.'})}catch(e){await c.query('ROLLBACK');res.status(500).json({erro:'Erro ao restaurar barbearia'})}finally{c.release()}});

router.patch('/barbearias/:id/assinatura',exigirStepUp,async(req,res)=>{
  const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Barbearia inválida'});
  const {plano,status,fim_trial,proxima_cobranca}=req.body||{};if(plano&&!validarPlano(plano))return res.status(400).json({erro:'Plano inválido'});if(status&&!validarStatus(status))return res.status(400).json({erro:'Status inválido'});if(fim_trial&&!isoDate(fim_trial))return res.status(400).json({erro:'Fim do trial inválido'});if(proxima_cobranca&&!isoDate(proxima_cobranca))return res.status(400).json({erro:'Próxima cobrança inválida'});
  const target=await pool.query(`SELECT 1 FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false`,[id]);if(!target.rowCount)return res.status(404).json({erro:'Barbearia não encontrada'});
  let locked=null;
  try{
    const ultima=await pool.query(`SELECT * FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[id]);if(!ultima.rowCount)return res.status(404).json({erro:'Assinatura não encontrada'});const a=ultima.rows[0];
    if(a.provedor==='mercadopago'&&a.referencia_externa&&status&&status!==a.status)return res.status(409).json({erro:'O status de uma assinatura Mercado Pago deve ser sincronizado pelo provedor. Use o fluxo de cobrança para evitar divergência.'});
    if(plano&&plano!==a.plano&&a.provedor==='mercadopago'&&a.referencia_externa&&['ativa','trial'].includes(a.status)){
      const l=await pool.query(`UPDATE assinaturas SET billing_change_pending=true,plano_pendente=$1,atualizado_em=NOW() WHERE id=$2 AND COALESCE(billing_change_pending,false)=false RETURNING id`,[plano,a.id]);
      if(!l.rowCount)return res.status(409).json({erro:'Já existe uma alteração de cobrança em andamento'});locked=a.id;
      try{await atualizarValorAssinatura(a.referencia_externa,precoPlano(plano,a.ciclo_cobranca||'mensal'));}
      catch(e){await pool.query(`UPDATE assinaturas SET billing_change_pending=false,plano_pendente=NULL WHERE id=$1`,[a.id]).catch(()=>{});console.error('Reconciliação plano MP:',e.providerCode||e.status||'provider_error');return res.status(502).json({erro:'Não foi possível atualizar o valor no Mercado Pago. O plano local não foi alterado.'});}
    }
    const r=await pool.query(`UPDATE assinaturas SET plano=COALESCE($1,plano),plano_pendente=NULL,status=COALESCE($2,status),fim_trial=COALESCE($3::date,fim_trial),proxima_cobranca=$4::date,billing_change_pending=false,atualizado_em=NOW() WHERE id=$5 RETURNING *`,[plano||null,status||null,fim_trial||null,proxima_cobranca||null,a.id]);
    await audit(req,{acao:'master.assinatura.alterada',barbeariaId:id,alvoTipo:'assinatura',alvoId:a.id,detalhes:{plano_anterior:a.plano,plano_novo:r.rows[0].plano,status_anterior:a.status,status_novo:r.rows[0].status}});
    res.json(r.rows[0]);
  }catch(e){if(locked)await pool.query(`UPDATE assinaturas SET billing_change_pending=false WHERE id=$1`,[locked]).catch(()=>{});console.error(e);res.status(500).json({erro:'Erro ao atualizar assinatura'});}
});


router.get('/settings/support',async(req,res)=>{try{res.json(await getSupportSettings())}catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar configurações de suporte'})}});
router.put('/settings/support',exigirStepUp,async(req,res)=>{try{const raw=String(req.body?.whatsapp||'').trim();let whatsapp=null;if(raw){whatsapp=normalizePhone(raw);if(whatsapp.length<10||whatsapp.length>15)return res.status(400).json({erro:'Informe um WhatsApp válido com DDD e país quando necessário'})}await setPlatformSetting('support_whatsapp',whatsapp,req.usuario.id);await audit(req,{acao:'master.suporte.whatsapp_configurado',barbeariaId:req.usuario.barbearia_id,alvoTipo:'platform_setting',alvoId:null,detalhes:{configurado:!!whatsapp}});res.json({whatsapp,mensagem:whatsapp?'WhatsApp do suporte atualizado':'WhatsApp do suporte removido'})}catch(e){console.error(e);res.status(500).json({erro:'Erro ao salvar WhatsApp do suporte'})}});

router.get('/payment-gateways',async(req,res)=>{try{res.json({gateways:await listPlatformGateways()})}catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar gateways da plataforma'})}});
router.post('/payment-gateways/:provedor/credenciais',exigirStepUp,async(req,res)=>{try{const provedor=String(req.params.provedor||'').toLowerCase();if(!PROVIDERS[provedor])return res.status(404).json({erro:'Gateway inválido'});const r=await savePlatformGatewayCredentials(req.usuario.id,provedor,req.body||{});await audit(req,{acao:'master.gateway.salvo',barbeariaId:req.usuario.barbearia_id,alvoTipo:'gateway',alvoId:null,detalhes:{provedor,ambiente:r.ambiente}});res.json({...r,mensagem:`Credenciais ${PROVIDERS[provedor].nome} salvas`})}catch(e){console.error('master_gateway_save',{provedor:String(req.params.provedor||'').slice(0,30),status:Number(e?.status)||null,provider_code:e?.providerCode||null,request_id:req.requestId});const status=Number(e.status)>=400&&Number(e.status)<500?Number(e.status):500;res.status(status).json({erro:publicError(e,'Erro ao salvar gateway',{allowClient:true}),request_id:req.requestId})}});
router.delete('/payment-gateways/:provedor',exigirStepUp,async(req,res)=>{try{const provedor=String(req.params.provedor||'').toLowerCase();if(!PROVIDERS[provedor])return res.status(404).json({erro:'Gateway inválido'});await disconnectPlatformGateway(provedor);await audit(req,{acao:'master.gateway.removido',barbeariaId:req.usuario.barbearia_id,alvoTipo:'gateway',alvoId:null,detalhes:{provedor}});res.json({mensagem:'Credenciais removidas'})}catch(e){const status=Number(e.status)>=400&&Number(e.status)<500?Number(e.status):500;res.status(status).json({erro:publicError(e,'Erro ao remover gateway',{allowClient:true}),request_id:req.requestId})}});

router.get('/perfil',async(req,res)=>{
  try{const r=await pool.query(`SELECT id,nome,email,telefone,papel,ativo,criado_em,atualizado_em FROM usuarios WHERE id=$1 AND papel='super_admin'`,[req.usuario.id]);if(!r.rowCount)return res.status(404).json({erro:'Supermaster não encontrado'});res.json(r.rows[0]);}
  catch(e){res.status(500).json({erro:'Erro ao carregar perfil'});}
});

router.patch('/perfil',exigirStepUp,async(req,res)=>{
  try{
    const nome=cleanText(req.body.nome,120,{required:true});const email=String(req.body.email||'').trim().toLowerCase();const telefone=normalizePhone(req.body.telefone)||null;
    if(!nome||!validEmail(email)||email.length>160)return res.status(400).json({erro:'Nome e e-mail válido são obrigatórios'});if(req.body.telefone&&(!telefone||telefone.length<10))return res.status(400).json({erro:'Telefone inválido'});
    const dup=await pool.query(`SELECT 1 FROM usuarios WHERE LOWER(email)=LOWER($1) AND id<>$2`,[email,req.usuario.id]);if(dup.rowCount)return res.status(409).json({erro:'E-mail já utilizado por outro usuário'});
    const r=await pool.query(`UPDATE usuarios SET nome=$1,email=$2,telefone=$3,atualizado_em=NOW() WHERE id=$4 AND papel='super_admin' RETURNING id,nome,email,telefone,papel`,[nome,email,telefone,req.usuario.id]);await audit(req,{acao:'master.perfil.alterado',barbeariaId:req.usuario.barbearia_id,alvoTipo:'usuario',alvoId:req.usuario.id,detalhes:{nome,email,telefone:telefone?telefone.slice(-4):null}});res.json(r.rows[0]);
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao atualizar perfil'});}
});

router.patch('/perfil/senha',exigirStepUp,async(req,res)=>{
  try{
    const atual=String(req.body.senha_atual||'');const nova=String(req.body.nova_senha||'');
    if(!strongPassword(nova))return res.status(400).json({erro:'Use senha com 12+ caracteres, maiúscula, minúscula, número e símbolo'});
    const r=await pool.query(`SELECT senha_hash FROM usuarios WHERE id=$1 AND papel='super_admin'`,[req.usuario.id]);if(!r.rowCount)return res.status(404).json({erro:'Supermaster não encontrado'});
    if(!(await bcrypt.compare(atual,r.rows[0].senha_hash)))return res.status(401).json({erro:'Senha atual incorreta'});
    const hash=await bcrypt.hash(nova,12);await pool.query(`UPDATE usuarios SET senha_hash=$1,token_version=COALESCE(token_version,0)+1,atualizado_em=NOW() WHERE id=$2`,[hash,req.usuario.id]);await audit(req,{acao:'master.senha.alterada',barbeariaId:req.usuario.barbearia_id,alvoTipo:'usuario',alvoId:req.usuario.id});require('../utils/security').clearSession(res);res.json({mensagem:'Senha atualizada. Faça login novamente.'});
  }catch(e){res.status(500).json({erro:'Erro ao alterar senha'});}
});


router.get('/system/health',async(req,res)=>{
  try{
    const started=Date.now();await pool.query('SELECT 1');const dbLatency=Date.now()-started;
    const [errors,support,webhooks,autos,payments,backup]=await Promise.all([
      pool.query(`SELECT COUNT(*)::int n FROM system_events WHERE nivel='error' AND criado_em>=NOW()-INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*)::int n FROM support_tickets WHERE status IN ('aberto','em_atendimento')`),
      pool.query(`SELECT COUNT(*)::int n FROM webhook_events WHERE status IN ('erro','falha_permanente')`),
      pool.query(`SELECT COUNT(*)::int n FROM automacoes_envios WHERE status='erro'`),
      pool.query(`SELECT COUNT(*)::int n FROM assinaturas_pagamentos WHERE status IN ('criando','pendente') AND criado_em<NOW()-INTERVAL '1 hour'`),
      pool.query(`SELECT status,destino,criado_em FROM backup_runs ORDER BY id DESC LIMIT 1`)
    ]);
    const mem=process.memoryUsage();
    res.json({ok:true,db_latency_ms:dbLatency,uptime_seconds:Math.round(process.uptime()),memory_mb:Math.round(mem.rss/1024/1024),errors_24h:errors.rows[0].n,support_open:support.rows[0].n,webhook_errors:webhooks.rows[0].n,automation_errors:autos.rows[0].n,stale_payments:payments.rows[0].n,backup:backup.rows[0]||null,backup_remote_configured:!!(process.env.BACKUP_UPLOAD_URL&&process.env.BACKUP_ENCRYPTION_KEY),release:process.env.RELEASE_VERSION||'4.5.0'});
  }catch(e){res.status(503).json({ok:false,erro:'Diagnóstico indisponível'})}
});

router.get('/support/tickets',async(req,res)=>{try{const status=String(req.query.status||'').trim();const vals=[];let where='';if(status&&['aberto','em_atendimento','resolvido','fechado'].includes(status)){vals.push(status);where='WHERE s.status=$1'}const r=await pool.query(`SELECT s.id,s.barbearia_id,b.nome barbearia,u.nome usuario,u.email,s.categoria,s.assunto,s.mensagem,s.status,s.prioridade,s.resposta,s.criado_em,s.atualizado_em FROM support_tickets s JOIN barbearias b ON b.id=s.barbearia_id LEFT JOIN usuarios u ON u.id=s.usuario_id ${where} ORDER BY CASE s.status WHEN 'aberto' THEN 1 WHEN 'em_atendimento' THEN 2 WHEN 'resolvido' THEN 3 ELSE 4 END,s.criado_em DESC LIMIT 100`,vals);res.json(r.rows)}catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar suporte'})}});
router.patch('/support/tickets/:id',exigirStepUp,async(req,res)=>{try{const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Chamado inválido'});const status=['aberto','em_atendimento','resolvido','fechado'].includes(String(req.body?.status))?String(req.body.status):null;const resposta=cleanText(req.body?.resposta,4000)||null;if(!status)return res.status(400).json({erro:'Status inválido'});const r=await pool.query(`UPDATE support_tickets SET status=$1,resposta=COALESCE($2,resposta),respondido_em=CASE WHEN $2 IS NOT NULL THEN NOW() ELSE respondido_em END,atualizado_em=NOW() WHERE id=$3 RETURNING *`,[status,resposta,id]);if(!r.rowCount)return res.status(404).json({erro:'Chamado não encontrado'});await audit(req,{acao:'master.suporte.atualizado',barbeariaId:r.rows[0].barbearia_id,alvoTipo:'support_ticket',alvoId:id,detalhes:{status}});notificar('support_ticket_updated',{barbearia_id:r.rows[0].barbearia_id,usuario_id:r.rows[0].usuario_id,ticket_id:id,assunto:r.rows[0].assunto,status}).catch(()=>{});res.json(r.rows[0])}catch(e){console.error(e);res.status(500).json({erro:'Erro ao atualizar chamado'})}});

module.exports=router;
