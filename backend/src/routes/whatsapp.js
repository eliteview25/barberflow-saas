const express=require('express');
const crypto=require('crypto');
const pool=require('../config/db');
const {autenticar,exigirPapel}=require('../middlewares/auth');
const {exigirRecurso}=require('../services/planos');
const {encrypt}=require('../services/secrets');
const {sendText}=require('../services/whatsapp');
const {enqueue,processEvent}=require('../services/webhookInbox');
const {processByProvider}=require('../services/webhookProcessors');
const qr=require('../services/whatsappQr');
const {cleanText}=require('../utils/validation');
const {normalizePhone}=require('../utils/security');
const router=express.Router();

function hashToken(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}

// Webhook oficial da Meta. Cada barbearia tem seu próprio Verify Token.
router.get('/webhook',async(req,res)=>{
  try{
    const mode=req.query['hub.mode'],token=req.query['hub.verify_token'],challenge=req.query['hub.challenge'];
    if(mode!=='subscribe'||!token)return res.sendStatus(403);
    const r=await pool.query(`SELECT 1 FROM whatsapp_verify_tokens WHERE token_hash=$1`,[hashToken(token)]);
    if(r.rowCount)return res.status(200).send(challenge);
    return res.sendStatus(403);
  }catch(e){console.error('Verificação webhook WhatsApp:',e.message);return res.sendStatus(500)}
});
router.post('/webhook',async(req,res)=>{
  try{
    const secret=process.env.META_WHATSAPP_APP_SECRET;if(!secret)return res.status(503).send('Webhook indisponível');
    const sig=String(req.headers['x-hub-signature-256']||''),expected='sha256='+crypto.createHmac('sha256',secret).update(req.rawBody||Buffer.from(JSON.stringify(req.body||{}))).digest('hex');
    const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
    const queued=[];
    for(const entry of req.body?.entry||[])for(const change of entry.changes||[]){const v=change.value||{},phoneId=v.metadata?.phone_number_id;for(const m of v.messages||[]){if(!m.id||!phoneId)continue;const row=await enqueue('whatsapp',String(m.id),{phoneId:String(phoneId),message:m});queued.push({id:String(m.id),status:row.status});}}
    res.sendStatus(200);
    for(const q of queued)if(q.status!=='processado')setImmediate(()=>processEvent('whatsapp',q.id,p=>processByProvider('whatsapp',p)).catch(e=>console.error('Webhook WhatsApp:',e.message)));
  }catch(e){console.error('Webhook WhatsApp:',e.message);return res.sendStatus(500)}
});

router.use(autenticar);
router.get('/status',exigirRecurso('automacoes'),async(req,res)=>{
  const tenant=req.usuario.barbearia_id;
  const r=await pool.query(`SELECT phone_number_id,business_account_id,numero,status,conectado_em,atualizado_em FROM integracoes_whatsapp WHERE barbearia_id=$1`,[tenant]);
  const c=await pool.query(`SELECT * FROM automacoes_config WHERE barbearia_id=$1`,[tenant]);
  const vt=await pool.query(`SELECT criado_em FROM whatsapp_verify_tokens WHERE barbearia_id=$1`,[tenant]);
  res.json({conectado:r.rowCount>0&&r.rows[0].status==='conectado',integracao:r.rows[0]||null,verify_token_configurado:!!vt.rowCount,verify_token_criado_em:vt.rows[0]?.criado_em||null,config:c.rows[0]||null});
});
router.post('/verify-token',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{
  const raw=crypto.randomBytes(24).toString('base64url');
  await pool.query(`INSERT INTO whatsapp_verify_tokens(barbearia_id,token_hash,criado_em) VALUES($1,$2,NOW()) ON CONFLICT(barbearia_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,criado_em=NOW()`,[req.usuario.barbearia_id,hashToken(raw)]);
  res.json({verify_token:raw,mensagem:'Token gerado. Copie agora e salve na Meta; por segurança ele não será exibido novamente.'});
});
router.post('/conectar',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{const x=req.body||{},phone_number_id=String(x.phone_number_id||'').replace(/\D/g,'').slice(0,40),business_account_id=String(x.business_account_id||'').replace(/\D/g,'').slice(0,40)||null,numero=normalizePhone(x.numero)||null,access_token=String(x.access_token||'').trim();if(!phone_number_id||phone_number_id.length<5||!access_token||access_token.length>4096)return res.status(400).json({erro:'Informe Phone Number ID e Access Token válidos da Cloud API'});const enc=encrypt(access_token);await pool.query(`INSERT INTO integracoes_whatsapp(barbearia_id,phone_number_id,business_account_id,numero,access_token_enc,status,conectado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,'conectado',NOW(),NOW()) ON CONFLICT(barbearia_id) DO UPDATE SET phone_number_id=EXCLUDED.phone_number_id,business_account_id=EXCLUDED.business_account_id,numero=EXCLUDED.numero,access_token_enc=EXCLUDED.access_token_enc,status='conectado',conectado_em=NOW(),atualizado_em=NOW()`,[req.usuario.barbearia_id,phone_number_id,business_account_id,numero,enc]);res.json({mensagem:'WhatsApp oficial conectado'})}catch(e){if(e.code==='23505')return res.status(409).json({erro:'Este Phone Number ID já está conectado a outra barbearia'});console.error(e);res.status(500).json({erro:'Erro ao conectar WhatsApp'})}});
router.delete('/conexao',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{await pool.query(`UPDATE integracoes_whatsapp SET status='desconectado',access_token_enc=NULL,atualizado_em=NOW() WHERE barbearia_id=$1`,[req.usuario.barbearia_id]);res.json({mensagem:'WhatsApp oficial desconectado'})});

// Conector por QR: saída apenas para lembretes. Não recebe mensagens nem executa o bot.
router.get('/qr/status',exigirRecurso('automacoes'),async(req,res)=>{try{res.json(await qr.status(req.usuario.barbearia_id))}catch(e){res.status(502).json({erro:e.message})}});
router.post('/qr/iniciar',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{res.json(await qr.start(req.usuario.barbearia_id))}catch(e){console.error('QR WhatsApp:',e.message);res.status(502).json({erro:e.message})}});
router.delete('/qr/conexao',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{await qr.disconnect(req.usuario.barbearia_id);res.json({mensagem:'Sessão QR removida'})}catch(e){res.status(502).json({erro:e.message})}});
router.post('/qr/teste',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{try{const telefone=normalizePhone(req.body.telefone);if(telefone.length<10)return res.status(400).json({erro:'Informe um telefone de teste válido'});await qr.sendText(req.usuario.barbearia_id,telefone,'Teste BarberFlow ✅ Lembretes por WhatsApp QR estão funcionando.');res.json({mensagem:'Mensagem de teste enviada pelo QR'})}catch(e){res.status(502).json({erro:e.message})}});

router.put('/config',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{
  const x=req.body||{};const canal=['cloud_api','qr'].includes(x.canal_lembretes)?x.canal_lembretes:'cloud_api';const tpl=v=>{const t=String(v||'').trim();return !t?null:/^[A-Za-z0-9_]{1,512}$/.test(t)?t:false};const t24=tpl(x.template_lembrete_24h),t2=tpl(x.template_lembrete_2h),tp=tpl(x.template_pos_atendimento);if([t24,t2,tp].includes(false))return res.status(400).json({erro:'Nome de template inválido'});const m24=cleanText(x.mensagem_lembrete_24h,4000)||null,m2=cleanText(x.mensagem_lembrete_2h,4000)||null,mp=cleanText(x.mensagem_pos_atendimento,4000)||null;
  const r=await pool.query(`INSERT INTO automacoes_config(barbearia_id,lembrete_24h,lembrete_2h,pos_atendimento,template_lembrete_24h,template_lembrete_2h,template_pos_atendimento,canal_lembretes,mensagem_lembrete_24h,mensagem_lembrete_2h,mensagem_pos_atendimento) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(barbearia_id) DO UPDATE SET lembrete_24h=EXCLUDED.lembrete_24h,lembrete_2h=EXCLUDED.lembrete_2h,pos_atendimento=EXCLUDED.pos_atendimento,template_lembrete_24h=EXCLUDED.template_lembrete_24h,template_lembrete_2h=EXCLUDED.template_lembrete_2h,template_pos_atendimento=EXCLUDED.template_pos_atendimento,canal_lembretes=EXCLUDED.canal_lembretes,mensagem_lembrete_24h=EXCLUDED.mensagem_lembrete_24h,mensagem_lembrete_2h=EXCLUDED.mensagem_lembrete_2h,mensagem_pos_atendimento=EXCLUDED.mensagem_pos_atendimento,atualizado_em=NOW() RETURNING *`,[req.usuario.barbearia_id,!!x.lembrete_24h,!!x.lembrete_2h,!!x.pos_atendimento,t24,t2,tp,canal,m24,m2,mp]);res.json(r.rows[0])
});
router.post('/teste',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{try{const r=await pool.query(`SELECT * FROM integracoes_whatsapp WHERE barbearia_id=$1 AND status='conectado'`,[req.usuario.barbearia_id]);if(!r.rowCount)return res.status(400).json({erro:'WhatsApp oficial não conectado'});const telefone=normalizePhone(req.body.telefone);if(telefone.length<10)return res.status(400).json({erro:'Informe um telefone de teste válido'});await sendText(r.rows[0],telefone,'Teste BarberFlow ✅ Sua integração com WhatsApp Cloud API está funcionando.');res.json({mensagem:'Mensagem de teste enviada'})}catch(e){res.status(502).json({erro:e.message})}});
module.exports=router;
