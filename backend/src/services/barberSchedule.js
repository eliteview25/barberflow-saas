const pool=require('../config/db');

async function ensureBarberScheduleSchema(db=pool){
  await db.query(`ALTER TABLE horarios_trabalho ADD COLUMN IF NOT EXISTS intervalo_inicio TIME`);
  await db.query(`ALTER TABLE horarios_trabalho ADD COLUMN IF NOT EXISTS intervalo_fim TIME`);
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_horarios_intervalo_valido') THEN
      ALTER TABLE horarios_trabalho ADD CONSTRAINT ck_horarios_intervalo_valido CHECK (
        (intervalo_inicio IS NULL AND intervalo_fim IS NULL) OR
        (intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL AND hora_inicio < intervalo_inicio AND intervalo_inicio < intervalo_fim AND intervalo_fim < hora_fim)
      );
    END IF;
  END $$`);
}

module.exports={ensureBarberScheduleSchema};
