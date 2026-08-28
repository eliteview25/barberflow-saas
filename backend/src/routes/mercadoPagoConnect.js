const express=require('express');
const {autenticar,exigirPapel}=require('../middlewares/auth');
const {criarUrlConexao,concluirConexao,statusConexao,desconectar}=require('../services/mercadoPagoOAuth');
const {exigirRecurso}=require('../services/planos');
const router=express.Router();

router.get('/status',autenticar,exigirPapel('dono','gerente'),exigirRecurso('pagamentos_online'),async(req,res)=>{try{res.json(await statusConexao(req.usuario.barbearia_id))}catch(e){res.status(500).json({erro:e.message})}});
router.get('/conectar',autenticar,exigirPapel('dono'),exigirRecurso('pagamentos_online'),async(req,res)=>{try{res.json({url:await criarUrlConexao(req.usuario.barbearia_id)})}catch(e){console.error(e);res.status(503).json({erro:e.message})}});
router.delete('/conexao',autenticar,exigirPapel('dono'),exigirRecurso('pagamentos_online'),async(req,res)=>{try{await desconectar(req.usuario.barbearia_id);res.json({mensagem:'Mercado Pago desconectado'})}catch(e){res.status(500).json({erro:'Erro ao desconectar Mercado Pago'})}});
router.get('/callback',async(req,res)=>{try{const{code,state,error,error_description}=req.query;if(error)return res.redirect(`/pages/pagamentos.html?gateway=mercadopago&status=erro&motivo=${encodeURIComponent(error_description||error)}`);if(!code||!state)throw new Error('Código OAuth ausente');await concluirConexao({code,state});res.redirect('/pages/pagamentos.html?gateway=mercadopago&status=conectado')}catch(e){console.error('OAuth Mercado Pago:',e.data||e);res.redirect(`/pages/pagamentos.html?gateway=mercadopago&status=erro&motivo=${encodeURIComponent(e.message||'Falha ao conectar')}`)}});
module.exports=router;
