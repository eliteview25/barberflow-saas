const pool=require('../config/db');
async function ensureProductSchema(){
  await pool.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT`);
  await pool.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW()`);
}
module.exports={ensureProductSchema};
