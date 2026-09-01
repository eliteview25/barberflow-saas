const express=require('express');
const {autenticar,exigirPapel,exigirStepUp}=require('../middlewares/auth');
const {criarUrlConexao,concluirConexao,statusConexao,desconectar}=require('../services/mercadoPagoOAuth');
const {exigirRecurso}=require('../services/planos');
const router=express.Router();

router.get('/status',autenticar,exigirPapel('dono','gerente'),exigirRecurso('pagamentos_online'),async(req,res)=>{try{res.json(await statusConexao(req.usuario.barbearia_id))}catch(e){console.error('mp_oauth_status',{status:Number(e?.status)||null,provider_code:e?.providerCode||null,request_id:req.requestId});res.status(500).json({erro:'Erro ao consultar conexão Mercado Pago',request_id:req.requestId})}});
router.post('/conectar',autenticar,exigirPapel('dono'),exigirRecurso('pagamentos_online'),exigirStepUp,async(req,res)=>{try{res.json({url:await criarUrlConexao(req.usuario.barbearia_id)})}catch(e){console.error('mp_oauth_start',{status:Number(e?.status)||null,provider_code:e?.providerCode||null,request_id:req.requestId});res.status(503).json({erro:'Não foi possível iniciar a conexão Mercado Pago',request_id:req.requestId})}});
router.delete('/conexao',autenticar,exigirPapel('dono'),exigirRecurso('pagamentos_online'),exigirStepUp,async(req,res)=>{try{await desconectar(req.usuario.barbearia_id);res.json({mensagem:'Mercado Pago desconectado'})}catch(e){res.status(500).json({erro:'Erro ao desconectar Mercado Pago'})}});
router.get('/callback',async(req,res)=>{try{const{code,state,error}=req.query;if(error)return res.redirect('/pages/pagamentos.html?gateway=mercadopago&status=erro');if(!code||!state)throw new Error('Código OAuth ausente');await concluirConexao({code:String(code).slice(0,1000),state:String(state).slice(0,200)});res.redirect('/pages/pagamentos.html?gateway=mercadopago&status=conectado')}catch(e){console.error('mp_oauth_callback',{status:Number(e?.status)||null,provider_code:e?.providerCode||null,request_id:req.requestId});res.redirect('/pages/pagamentos.html?gateway=mercadopago&status=erro')}});
module.exports=router;
