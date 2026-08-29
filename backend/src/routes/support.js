const express=require('express');
const pool=require('../config/db');
const {autenticar}=require('../middlewares/auth');
const {cleanText,intId}=require('../utils/validation');
const {getSupportSettings}=require('../services/platformSettings');
const router=express.Router();
router.use(autenticar);

router.get('/config',async(req,res)=>{try{res.json(await getSupportSettings())}catch(e){console.error(e);res.json({email:process.env.SUPPORT_EMAIL||null,whatsapp:process.env.SUPPORT_WHATSAPP||null})}});
router.get('/tickets',async(req,res)=>{try{const r=await pool.query(`SELECT id,categoria,assunto,mensagem,status,prioridade,resposta,respondido_em,criado_em,atualizado_em FROM support_tickets WHERE barbearia_id=$1 ORDER BY criado_em DESC LIMIT 50`,[req.usuario.barbearia_id]);res.json(r.rows)}catch(e){console.error(e);res.status(500).json({erro:'Erro ao carregar chamados'})}});
router.post('/tickets',async(req,res)=>{try{const categoria=['acesso','pagamento','agendamento','configuracao','outro'].includes(String(req.body?.categoria))?String(req.body.categoria):'outro';const assunto=cleanText(req.body?.assunto,160,{required:true}),mensagem=cleanText(req.body?.mensagem,3000,{required:true});if(!assunto||!mensagem)return res.status(400).json({erro:'Informe assunto e mensagem'});const r=await pool.query(`INSERT INTO support_tickets(barbearia_id,usuario_id,categoria,assunto,mensagem) VALUES($1,$2,$3,$4,$5) RETURNING id,categoria,assunto,status,prioridade,criado_em`,[req.usuario.barbearia_id,req.usuario.id,categoria,assunto,mensagem]);res.status(201).json({mensagem:'Chamado enviado ao suporte',ticket:r.rows[0]})}catch(e){console.error(e);res.status(500).json({erro:'Erro ao abrir chamado'})}});
router.patch('/tickets/:id/fechar',async(req,res)=>{try{const id=intId(req.params.id);if(!id)return res.status(400).json({erro:'Chamado inválido'});const r=await pool.query(`UPDATE support_tickets SET status='fechado',atualizado_em=NOW() WHERE id=$1 AND barbearia_id=$2 AND status='resolvido' RETURNING id,status`,[id,req.usuario.barbearia_id]);if(!r.rowCount)return res.status(409).json({erro:'Somente chamados resolvidos podem ser fechados'});res.json(r.rows[0])}catch(e){res.status(500).json({erro:'Erro ao fechar chamado'})}});
module.exports=router;
