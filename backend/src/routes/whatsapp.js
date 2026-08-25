const express=require('express');
const crypto=require('crypto');
const pool=require('../config/db');
const {autenticar,exigirPapel}=require('../middlewares/auth');
const {exigirRecurso}=require('../services/planos');
const {encrypt}=require('../services/secrets');
const {integrationByPhoneId,processIncoming,sendText}=require('../services/whatsapp');
const qr=require('../services/whatsappQr');
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
router.post('/webhook',(req,res)=>{res.sendStatus(200);setImmediate(async()=>{try{for(const entry of req.body?.entry||[]){for(const change of entry.changes||[]){const v=change.value||{},phoneId=v.metadata?.phone_number_id,integ=phoneId?await integrationByPhoneId(phoneId):null;if(!integ)continue;for(const m of v.messages||[]){if(m.type!=='text')continue;await processIncoming(integ,m.from,m.text?.body||'')}}}}catch(e){console.error('Webhook WhatsApp:',e.message)}})});

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
router.post('/conectar',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{const{phone_number_id,business_account_id,numero,access_token}=req.body;if(!phone_number_id||!access_token)return res.status(400).json({erro:'Informe Phone Number ID e Access Token da Cloud API'});const enc=encrypt(access_token);await pool.query(`INSERT INTO integracoes_whatsapp(barbearia_id,phone_number_id,business_account_id,numero,access_token_enc,status,conectado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,'conectado',NOW(),NOW()) ON CONFLICT(barbearia_id) DO UPDATE SET phone_number_id=EXCLUDED.phone_number_id,business_account_id=EXCLUDED.business_account_id,numero=EXCLUDED.numero,access_token_enc=EXCLUDED.access_token_enc,status='conectado',conectado_em=NOW(),atualizado_em=NOW()`,[req.usuario.barbearia_id,String(phone_number_id),business_account_id||null,numero||null,enc]);res.json({mensagem:'WhatsApp oficial conectado'})}catch(e){if(e.code==='23505')return res.status(409).json({erro:'Este Phone Number ID já está conectado a outra barbearia'});console.error(e);res.status(500).json({erro:'Erro ao conectar WhatsApp'})}});
router.delete('/conexao',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{await pool.query(`UPDATE integracoes_whatsapp SET status='desconectado',access_token_enc=NULL,atualizado_em=NOW() WHERE barbearia_id=$1`,[req.usuario.barbearia_id]);res.json({mensagem:'WhatsApp oficial desconectado'})});

// Conector por QR: saída apenas para lembretes. Não recebe mensagens nem executa o bot.
router.get('/qr/status',exigirRecurso('automacoes'),async(req,res)=>{try{res.json(await qr.status(req.usuario.barbearia_id))}catch(e){res.status(502).json({erro:e.message})}});
router.post('/qr/iniciar',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{res.json(await qr.start(req.usuario.barbearia_id))}catch(e){console.error('QR WhatsApp:',e.message);res.status(502).json({erro:e.message})}});
router.delete('/qr/conexao',exigirPapel('dono'),exigirRecurso('automacoes'),async(req,res)=>{try{await qr.disconnect(req.usuario.barbearia_id);res.json({mensagem:'Sessão QR removida'})}catch(e){res.status(502).json({erro:e.message})}});
router.post('/qr/teste',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{try{if(!req.body.telefone)return res.status(400).json({erro:'Informe o telefone de teste'});await qr.sendText(req.usuario.barbearia_id,req.body.telefone,'Teste BarberFlow ✅ Lembretes por WhatsApp QR estão funcionando.');res.json({mensagem:'Mensagem de teste enviada pelo QR'})}catch(e){res.status(502).json({erro:e.message})}});

router.put('/config',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{
  const x=req.body||{};const canal=['cloud_api','qr'].includes(x.canal_lembretes)?x.canal_lembretes:'cloud_api';
  const r=await pool.query(`INSERT INTO automacoes_config(barbearia_id,lembrete_24h,lembrete_2h,pos_atendimento,template_lembrete_24h,template_lembrete_2h,template_pos_atendimento,canal_lembretes,mensagem_lembrete_24h,mensagem_lembrete_2h,mensagem_pos_atendimento) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(barbearia_id) DO UPDATE SET lembrete_24h=EXCLUDED.lembrete_24h,lembrete_2h=EXCLUDED.lembrete_2h,pos_atendimento=EXCLUDED.pos_atendimento,template_lembrete_24h=EXCLUDED.template_lembrete_24h,template_lembrete_2h=EXCLUDED.template_lembrete_2h,template_pos_atendimento=EXCLUDED.template_pos_atendimento,canal_lembretes=EXCLUDED.canal_lembretes,mensagem_lembrete_24h=EXCLUDED.mensagem_lembrete_24h,mensagem_lembrete_2h=EXCLUDED.mensagem_lembrete_2h,mensagem_pos_atendimento=EXCLUDED.mensagem_pos_atendimento,atualizado_em=NOW() RETURNING *`,[req.usuario.barbearia_id,!!x.lembrete_24h,!!x.lembrete_2h,!!x.pos_atendimento,x.template_lembrete_24h||null,x.template_lembrete_2h||null,x.template_pos_atendimento||null,canal,x.mensagem_lembrete_24h||null,x.mensagem_lembrete_2h||null,x.mensagem_pos_atendimento||null]);res.json(r.rows[0])
});
router.post('/teste',exigirPapel('dono','gerente'),exigirRecurso('automacoes'),async(req,res)=>{try{const r=await pool.query(`SELECT * FROM integracoes_whatsapp WHERE barbearia_id=$1 AND status='conectado'`,[req.usuario.barbearia_id]);if(!r.rowCount)return res.status(400).json({erro:'WhatsApp oficial não conectado'});if(!req.body.telefone)return res.status(400).json({erro:'Informe o telefone de teste'});await sendText(r.rows[0],req.body.telefone,'Teste BarberFlow ✅ Sua integração com WhatsApp Cloud API está funcionando.');res.json({mensagem:'Mensagem de teste enviada'})}catch(e){res.status(502).json({erro:e.message})}});
module.exports=router;
