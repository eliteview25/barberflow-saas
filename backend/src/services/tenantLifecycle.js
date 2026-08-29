const pool=require('../config/db');

async function ensureTenantLifecycleSchema(db=pool){
  await db.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS exclusao_programada_em TIMESTAMP`);
  await db.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS excluida_por INTEGER`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_barbearias_exclusao_programada ON barbearias(exclusao_programada_em) WHERE exclusao_programada_em IS NOT NULL`);
}

async function deleteTenantData(id,db){
  // Dependências sem cascade precisam sair primeiro. As demais tabelas tenant-scoped
  // têm barbearia_id e/ou ON DELETE CASCADE, mas removemos explicitamente para
  // garantir eliminação completa e previsível.
  await db.query(`DELETE FROM venda_itens WHERE venda_id IN (SELECT id FROM vendas WHERE barbearia_id=$1)`,[id]);
  await db.query(`DELETE FROM password_resets WHERE usuario_id IN (SELECT id FROM usuarios WHERE barbearia_id=$1)`,[id]);
  await db.query(`DELETE FROM email_verification_tokens WHERE usuario_id IN (SELECT id FROM usuarios WHERE barbearia_id=$1)`,[id]);
  const ordered=[
    'automacoes_envios','avaliacoes','reservas_pagamento','fila_espera','fidelidade_saldos','vendas','horarios_trabalho','agendamentos',
    'legal_acceptances','support_tickets','booking_otps','metas_financeiras','ai_uso_mensal','ai_config','automacoes_config','fidelidade_config','pacotes',
    'integracoes_whatsapp_qr','whatsapp_verify_tokens','whatsapp_sessoes','integracoes_whatsapp','oauth_states','integracoes_pagamento',
    'assinaturas_pagamentos','assinaturas_cobrancas','produtos','clientes','usuarios','barbeiros','servicos','assinaturas'
  ];
  for(const table of ordered){
    try{await db.query(`DELETE FROM ${table} WHERE barbearia_id=$1`,[id]);}
    catch(e){if(e.code!=='42P01'&&e.code!=='42703')throw e;}
  }
  // Logs podem conter informações do tenant; em eliminação permanente também saem.
  for(const table of ['audit_logs','system_events']){
    try{await db.query(`DELETE FROM ${table} WHERE barbearia_id=$1`,[id]);}catch(e){if(e.code!=='42P01'&&e.code!=='42703')throw e;}
  }
  const r=await db.query(`DELETE FROM barbearias WHERE id=$1 AND COALESCE(is_system,false)=false RETURNING id,nome`,[id]);
  return r.rows[0]||null;
}

async function purgeTenantPermanent(id,{db=pool}={}){
  const client=db===pool?await pool.connect():db;
  try{
    if(db===pool)await client.query('BEGIN');
    const row=(await client.query(`SELECT id,nome,is_system FROM barbearias WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if(!row||row.is_system){if(db===pool)await client.query('ROLLBACK');return null;}
    const out=await deleteTenantData(id,client);
    if(db===pool)await client.query('COMMIT');
    return out;
  }catch(e){if(db===pool)await client.query('ROLLBACK').catch(()=>{});throw e;}finally{if(db===pool)client.release();}
}

async function purgeExpiredTenants(){
  await ensureTenantLifecycleSchema();
  const rows=(await pool.query(`SELECT id FROM barbearias WHERE COALESCE(is_system,false)=false AND excluido_em IS NOT NULL AND exclusao_programada_em IS NOT NULL AND exclusao_programada_em<=NOW() ORDER BY exclusao_programada_em LIMIT 25`)).rows;
  let purged=0;
  for(const row of rows){try{if(await purgeTenantPermanent(row.id))purged++;}catch(e){console.error('tenant_purge_failed',{barbearia_id:row.id,message:e.message});}}
  return purged;
}

module.exports={ensureTenantLifecycleSchema,purgeTenantPermanent,purgeExpiredTenants};
