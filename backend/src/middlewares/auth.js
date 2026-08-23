const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const r = await pool.query(`
      SELECT u.id,u.barbearia_id,u.nome,u.email,u.papel,u.barbeiro_id
      FROM usuarios u
      JOIN barbearias b ON b.id=u.barbearia_id
      WHERE u.id=$1 AND u.ativo=true AND b.ativo=true
    `,[payload.id]);
    if (!r.rowCount) return res.status(401).json({ erro:'Usuário inativo ou removido' });
    req.usuario = r.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  }
}

function exigirPapel(...papeis) {
  return (req,res,next)=>{
    if(!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({erro:'Você não tem permissão para esta ação'});
    }
    next();
  };
}

async function exigirAssinatura(req,res,next){
  try{
    const r=await pool.query(`SELECT status,fim_trial FROM assinaturas WHERE barbearia_id=$1 ORDER BY id DESC LIMIT 1`,[req.usuario.barbearia_id]);
    if(!r.rowCount)return res.status(402).json({erro:'Barbearia sem assinatura'});
    const a=r.rows[0];
    const trialOk=a.status==='trial' && a.fim_trial && new Date(a.fim_trial)>=new Date(new Date().toISOString().slice(0,10));
    if(a.status!=='ativa' && !trialOk) return res.status(402).json({erro:'Assinatura inativa ou período de teste encerrado'});
    req.assinatura=a; next();
  }catch(e){console.error(e);res.status(500).json({erro:'Erro ao validar assinatura'});}
}
module.exports = { autenticar, exigirPapel, exigirAssinatura };
