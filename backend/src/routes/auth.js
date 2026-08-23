const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { autenticar } = require('../middlewares/auth');
const router = express.Router();

function slugify(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

router.post('/registrar', async (req,res) => {
  const { barbearia, nome, email, senha, telefone } = req.body;
  if (!barbearia || !nome || !email || !senha) return res.status(400).json({ erro: 'Barbearia, nome, e-mail e senha são obrigatórios' });
  if (senha.length < 8) return res.status(400).json({ erro: 'A senha deve ter pelo menos 8 caracteres' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existe = await client.query('SELECT 1 FROM usuarios WHERE LOWER(email)=LOWER($1)', [email]);
    if (existe.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ erro: 'E-mail já cadastrado' }); }
    let slugBase = slugify(barbearia) || 'barbearia'; let slug = slugBase; let i = 1;
    while ((await client.query('SELECT 1 FROM barbearias WHERE slug=$1',[slug])).rowCount) slug = `${slugBase}-${++i}`;
    const tenant = await client.query(`INSERT INTO barbearias (nome,slug,telefone,ativo) VALUES ($1,$2,$3,true) RETURNING *`, [barbearia,slug,telefone||null]);
    const hash = await bcrypt.hash(senha, 12);
    const user = await client.query(`INSERT INTO usuarios (barbearia_id,nome,email,senha_hash,papel,ativo) VALUES ($1,$2,$3,$4,'dono',true) RETURNING id,nome,email,papel`, [tenant.rows[0].id,nome,email.toLowerCase(),hash]);
    await client.query(`INSERT INTO assinaturas (barbearia_id,plano,status,inicio,fim_trial) VALUES ($1,'pro','trial',CURRENT_DATE,CURRENT_DATE + INTERVAL '14 days')`, [tenant.rows[0].id]);
    await client.query('COMMIT');
    const token = jwt.sign({ id:user.rows[0].id, barbearia_id:tenant.rows[0].id, papel:user.rows[0].papel, nome:user.rows[0].nome }, process.env.JWT_SECRET, { expiresIn:'12h' });
    res.status(201).json({ token, usuario:user.rows[0], barbearia:tenant.rows[0] });
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ erro:'Erro ao criar conta' }); }
  finally { client.release(); }
});

router.post('/login', async (req,res) => {
  const { email, senha } = req.body;
  const r = await pool.query(`SELECT u.*, b.nome AS barbearia_nome, b.slug FROM usuarios u JOIN barbearias b ON b.id=u.barbearia_id WHERE LOWER(u.email)=LOWER($1) AND u.ativo=true AND b.ativo=true`, [email||'']);
  if (!r.rowCount || !(await bcrypt.compare(senha||'', r.rows[0].senha_hash))) return res.status(401).json({ erro:'E-mail ou senha inválidos' });
  const u = r.rows[0];
  const token = jwt.sign({ id:u.id, barbearia_id:u.barbearia_id, papel:u.papel, nome:u.nome }, process.env.JWT_SECRET, { expiresIn:'12h' });
  res.json({ token, usuario:{id:u.id,nome:u.nome,email:u.email,papel:u.papel,barbeiro_id:u.barbeiro_id}, barbearia:{id:u.barbearia_id,nome:u.barbearia_nome,slug:u.slug} });
});


router.post('/solicitar-reset', async (req,res) => {
  const r=await pool.query(`SELECT id FROM usuarios WHERE LOWER(email)=LOWER($1) AND ativo=true`,[req.body.email||'']);
  if(!r.rowCount) return res.json({mensagem:'Se o e-mail existir, as instruções serão enviadas.'});
  const raw=crypto.randomBytes(32).toString('hex'); const hash=crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query(`INSERT INTO password_resets(usuario_id,token_hash,expira_em) VALUES($1,$2,NOW()+INTERVAL '30 minutes')`,[r.rows[0].id,hash]);
  const base=process.env.APP_URL||'http://localhost:3001'; const resposta={mensagem:'Se o e-mail existir, as instruções serão enviadas.'};
  if(process.env.NODE_ENV!=='production') resposta.link_dev=`${base}/redefinir-senha.html?token=${raw}`;
  res.json(resposta);
});
router.post('/redefinir-senha', async (req,res) => {
  const {token,senha}=req.body; if(!token||!senha||senha.length<8)return res.status(400).json({erro:'Token e nova senha válida são obrigatórios'});
  const hash=crypto.createHash('sha256').update(token).digest('hex'); const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const r=await client.query(`SELECT * FROM password_resets WHERE token_hash=$1 AND usado=false AND expira_em>NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE`,[hash]);
    if(!r.rowCount){await client.query('ROLLBACK');return res.status(400).json({erro:'Link inválido ou expirado'});}
    const senhaHash=await bcrypt.hash(senha,12); await client.query(`UPDATE usuarios SET senha_hash=$1 WHERE id=$2`,[senhaHash,r.rows[0].usuario_id]); await client.query(`UPDATE password_resets SET usado=true WHERE id=$1`,[r.rows[0].id]); await client.query('COMMIT'); res.json({mensagem:'Senha atualizada'});
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});

router.get('/me', autenticar, async (req,res) => {
  const r = await pool.query(`SELECT u.id,u.nome,u.email,u.papel,u.barbeiro_id,b.id AS barbearia_id,b.nome AS barbearia_nome,b.slug FROM usuarios u JOIN barbearias b ON b.id=u.barbearia_id WHERE u.id=$1`, [req.usuario.id]);
  if (!r.rowCount) return res.status(404).json({erro:'Usuário não encontrado'});
  res.json(r.rows[0]);
});
module.exports = router;
