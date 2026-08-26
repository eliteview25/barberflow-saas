const jwt=require('jsonwebtoken');
const pool=require('../config/db');
const {contextoPlano}=require('../services/planos');
const {parseCookies,validateCsrf}=require('../utils/security');

async function autenticar(req,res,next){
  const cookies=parseCookies(req);const header=req.headers.authorization||'';
  const token=cookies.bf_session||(header.startsWith('Bearer ')?header.slice(7):null);
  if(!token)return res.status(401).json({erro:'Não autenticado'});
  if(!validateCsrf(req))return res.status(403).json({erro:'Validação CSRF falhou'});
  try{
    const payload=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
    if(payload.purpose!=='session')throw new Error('Token de propósito inválido');
    const r=await pool.query(`SELECT u.id,u.barbearia_id,u.nome,u.email,u.papel,u.barbeiro_id,COALESCE(u.token_version,0)::int token_version,COALESCE(u.mfa_enabled,false) mfa_enabled FROM usuarios u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.id=$1 AND u.ativo=true AND (u.papel='super_admin' OR (b.ativo=true AND b.excluido_em IS NULL))`,[payload.id]);
    if(!r.rowCount)return res.status(401).json({erro:'Usuário inativo ou removido'});
    const u=r.rows[0];if(Number(payload.sv||0)!==Number(u.token_version||0))return res.status(401).json({erro:'Sessão revogada'});
    req.usuario=u;req.authPayload=payload;next();
  }catch(e){return res.status(401).json({erro:'Sessão inválida ou expirada'});}
}
function exigirPapel(...papeis){return(req,res,next)=>{if(!req.usuario||!papeis.includes(req.usuario.papel))return res.status(403).json({erro:'Você não tem permissão para esta ação'});next();}}
async function exigirAssinatura(req,res,next){try{const ctx=await contextoPlano(req.usuario.barbearia_id);if(!ctx.assinatura)return res.status(402).json({erro:'Barbearia sem assinatura'});if(ctx.assinatura.status!=='ativa'&&!ctx.trial_ativo)return res.status(402).json({erro:'Assinatura inativa ou período de teste encerrado'});req.assinatura={...ctx.assinatura,plano_efetivo:ctx.plano_efetivo,recursos:ctx.recursos,trial_ativo:ctx.trial_ativo,dias_trial:ctx.dias_trial};next()}catch(e){console.error(e);res.status(500).json({erro:'Erro ao validar assinatura'})}}
function exigirStepUp(req,res,next){try{const t=parseCookies(req).bf_stepup;if(!t)return res.status(428).json({erro:'Confirmação de segurança necessária',step_up_required:true});const p=jwt.verify(t,process.env.JWT_SECRET,{algorithms:['HS256']});if(p.purpose!=='stepup'||Number(p.id)!==Number(req.usuario.id)||Number(p.sv||-1)!==Number(req.usuario.token_version||0))throw new Error('stepup inválido');next()}catch{return res.status(428).json({erro:'Confirmação de segurança necessária',step_up_required:true})}}
module.exports={autenticar,exigirPapel,exigirAssinatura,exigirStepUp};
