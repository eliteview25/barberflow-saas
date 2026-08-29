const pool=require('../config/db');

async function ensurePlatformSettingsSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS platform_settings(
    chave VARCHAR(80) PRIMARY KEY,
    valor TEXT,
    atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
}

async function getPlatformSetting(chave){
  await ensurePlatformSettingsSchema();
  const r=await pool.query(`SELECT valor FROM platform_settings WHERE chave=$1 LIMIT 1`,[String(chave)]);
  return r.rowCount?r.rows[0].valor:null;
}

async function setPlatformSetting(chave,valor,userId=null){
  await ensurePlatformSettingsSchema();
  const v=valor===null||valor===undefined||String(valor).trim()===''?null:String(valor).trim();
  await pool.query(`INSERT INTO platform_settings(chave,valor,atualizado_por,atualizado_em)
    VALUES($1,$2,$3,NOW())
    ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=NOW()`,[String(chave),v,userId||null]);
  return v;
}

async function getSupportSettings(){
  const whatsapp=(await getPlatformSetting('support_whatsapp'))||process.env.SUPPORT_WHATSAPP||null;
  const email=(await getPlatformSetting('support_email'))||process.env.SUPPORT_EMAIL||null;
  return {whatsapp,email};
}

module.exports={ensurePlatformSettingsSchema,getPlatformSetting,setPlatformSetting,getSupportSettings};
