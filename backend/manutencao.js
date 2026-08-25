require('dotenv').config();
const pool=require('./src/config/db');
(async()=>{try{
  const resultados={};
  let r=await pool.query(`UPDATE reservas_pagamento SET status='expirada',atualizado_em=NOW() WHERE status='aguardando_pagamento' AND expira_em<NOW()`);resultados.reservas_expiradas=r.rowCount;
  r=await pool.query(`DELETE FROM oauth_states WHERE expira_em<NOW()-INTERVAL '1 day'`);resultados.oauth_states_removidos=r.rowCount;
  r=await pool.query(`DELETE FROM password_resets WHERE (usado=true OR expira_em<NOW()) AND criado_em<NOW()-INTERVAL '7 days'`);resultados.password_resets_removidos=r.rowCount;
  r=await pool.query(`DELETE FROM whatsapp_sessoes WHERE atualizado_em<NOW()-INTERVAL '3 days'`);resultados.sessoes_whatsapp_removidas=r.rowCount;
  console.table([resultados]);console.log('✅ Manutenção concluída.');
}catch(e){console.error('❌ Manutenção falhou:',e.message);process.exitCode=1}finally{await pool.end()}})();
