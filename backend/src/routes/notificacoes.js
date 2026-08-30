const express=require('express');
const {autenticar}=require('../middlewares/auth');
const {listarNotificacoes,marcarLida,marcarTodasLidas}=require('../services/notificationCenter');

const router=express.Router();
router.use(autenticar);

router.get('/',async(req,res)=>{
  try{res.json(await listarNotificacoes(req.usuario,req.query.limit))}
  catch(e){console.error('notification_list',e.message);res.status(500).json({erro:'Não foi possível carregar as notificações'})}
});

router.patch('/:id/lida',async(req,res)=>{
  try{if(!await marcarLida(req.usuario,req.params.id))return res.status(404).json({erro:'Notificação não encontrada'});res.json({ok:true})}
  catch(e){console.error('notification_read',e.message);res.status(500).json({erro:'Não foi possível atualizar a notificação'})}
});

router.post('/ler-todas',async(req,res)=>{
  try{res.json({ok:true,atualizadas:await marcarTodasLidas(req.usuario)})}
  catch(e){console.error('notification_read_all',e.message);res.status(500).json({erro:'Não foi possível atualizar as notificações'})}
});

module.exports=router;
