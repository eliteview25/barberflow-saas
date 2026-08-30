const pool=require('../config/db');
async function ensureBarberProfileSchema(db=pool){
  await db.query(`ALTER TABLE barbeiros ADD COLUMN IF NOT EXISTS foto_url TEXT`);
}
module.exports={ensureBarberProfileSchema};
