const crypto=require('crypto');
const express=require('express');
const {validarWebhook,validarMpTenantSignature}=require('../services/mercadoPago');
const {timingSafeText}=require('../utils/security');
const {enqueue,processEvent,pending}=require('../services/webhookInbox');
const {processByProvider}=require('../services/webhookProcessors');
const router=express.Router();

function kick(provider,eventId){setImmediate(()=>processEvent(provider,eventId,p=>processByProvider(provider,p)).catch(e=>console.error(`Webhook ${provider} ${eventId}:`,e.message)));}
function mpEventId(req,type,dataId){const own=String(req.body?.id||'').trim();if(/^\d{1,30}$/.test(own))return `mp:${String(type||'unknown').slice(0,40)}:${own}`;const action=String(req.body?.action||req.query.action||'').trim();const raw=Buffer.isBuffer(req.rawBody)?req.rawBody:Buffer.from(JSON.stringify(req.body||{}));const h=crypto.createHash('sha256').update(String(type)).update('\0').update(action).update('\0').update(String(dataId)).update('\0').update(raw).digest('hex');return `mp:${h}`;}
router.post('/mercadopago',async(req,res)=>{try{
  const dataId=String(req.query['data.id']||'');const type=String(req.query.type||req.body?.type||req.query.topic||'');const secret=process.env.MP_WEBHOOK_SECRET||'';
  if(!dataId||!validarWebhook({xSignature:req.headers['x-signature'],xRequestId:req.headers['x-request-id'],dataId,secret}))return res.status(401).json({erro:'Assinatura do webhook inválida'});
  const eventId=mpEventId(req,type,dataId);let barbeariaId=null,paymentScope=null;if(type==='payment'||type==='payments'){const candidate=Number(req.query.barbearia_id);if(!Number.isSafeInteger(candidate)||candidate<1||!validarMpTenantSignature(candidate,req.query.tenant_sig))return res.status(401).json({erro:'Roteamento do webhook inválido'});barbeariaId=candidate;paymentScope=req.query.scope==='subscription'?'subscription':'booking';}const row=await enqueue('mercadopago',eventId,{type,dataId,barbeariaId,paymentScope});if(row.status!=='processado')kick('mercadopago',eventId);return res.sendStatus(200);
}catch(e){console.error('Recepção webhook MP:',e.message);return res.sendStatus(500)}});

router.post('/billing',async(req,res)=>{try{const configured=process.env.BILLING_WEBHOOK_SECRET||'';if(!configured||!timingSafeText(req.headers['x-barberflow-secret'],configured))return res.status(401).json({erro:'Webhook não autorizado'});const eventId=String(req.headers['x-idempotency-key']||'').trim();if(!eventId||eventId.length>200)return res.status(400).json({erro:'X-Idempotency-Key obrigatório'});const row=await enqueue('billing',eventId,req.body||{});if(row.status!=='processado')kick('billing',eventId);return res.status(202).json({mensagem:'Evento recebido'})}catch(e){console.error('Recepção webhook billing:',e.message);res.status(500).json({erro:'Erro ao receber webhook'})}});

router.post('/processar-pendentes',async(req,res)=>{const configured=process.env.CRON_SECRET||'';if(!configured||!timingSafeText(req.headers['x-cron-secret'],configured))return res.status(401).json({erro:'Não autorizado'});const rows=await pending(100),out=[];for(const row of rows){try{out.push({provider:row.provider,event_id:row.event_id,...await processEvent(row.provider,row.event_id,p=>processByProvider(row.provider,p))})}catch(e){out.push({provider:row.provider,event_id:row.event_id,ok:false,error:e.message})}}res.json({processados:out.length,resultados:out})});
module.exports=router;
