const pool=require('../config/db');

async function ensureAccountSecuritySchema(){
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT`);
}

module.exports={ensureAccountSecuritySchema};
