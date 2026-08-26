require('dotenv').config();
const pool=require('./src/config/db');
(async()=>{try{
 const out={};let r;
 r=await pool.query(`UPDATE reservas_pagamento SET status='expirada',atualizado_em=NOW() WHERE status IN ('aguardando_pagamento','pagamento_pendente','aguardando_pix_manual') AND expira_em<NOW()`);out.reservas_expiradas=r.rowCount;
 r=await pool.query(`DELETE FROM oauth_states WHERE expira_em<NOW()-INTERVAL '1 day'`);out.oauth_states_removidos=r.rowCount;
 r=await pool.query(`DELETE FROM password_resets WHERE (usado=true OR expira_em<NOW()) AND criado_em<NOW()-INTERVAL '7 days'`);out.password_resets_removidos=r.rowCount;
 r=await pool.query(`DELETE FROM email_verification_tokens WHERE (usado=true OR expira_em<NOW()) AND criado_em<NOW()-INTERVAL '7 days'`);out.email_tokens_removidos=r.rowCount;
 r=await pool.query(`DELETE FROM booking_otps WHERE (usado=true OR expira_em<NOW()) AND criado_em<NOW()-INTERVAL '2 days'`);out.booking_otps_removidos=r.rowCount;
 r=await pool.query(`DELETE FROM whatsapp_sessoes WHERE atualizado_em<NOW()-INTERVAL '3 days'`);out.sessoes_whatsapp_removidas=r.rowCount;
 r=await pool.query(`UPDATE webhook_events SET status='erro',erro=COALESCE(erro,'Processamento interrompido; liberado pela manutenção'),proxima_tentativa=NOW(),atualizado_em=NOW() WHERE status='processando' AND atualizado_em<NOW()-INTERVAL '15 minutes'`);out.webhooks_destravados=r.rowCount;
 r=await pool.query(`UPDATE automacoes_envios SET status='erro',erro=COALESCE(erro,'Envio interrompido; liberado pela manutenção'),proxima_tentativa=NOW(),atualizado_em=NOW() WHERE status='processando' AND COALESCE(atualizado_em,enviado_em)<NOW()-INTERVAL '30 minutes' AND tentativas<5`);out.automacoes_destravadas=r.rowCount;
 r=await pool.query(`DELETE FROM webhook_events WHERE status='processado' AND processado_em<NOW()-INTERVAL '90 days'`);out.webhooks_antigos_removidos=r.rowCount;
 console.table([out]);console.log('✅ Manutenção concluída.');
}catch(e){console.error('❌ Manutenção falhou:',e.message);process.exitCode=1}finally{await pool.end()}})();
