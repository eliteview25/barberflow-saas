const pool=require('../config/db');
const crypto=require('crypto');
const {matchingTotpStep}=require('../utils/totp');

let schemaReady=null;
async function ensureAccountSecuritySchema(){
  if(!schemaReady)schemaReady=(async()=>{await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT`);
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT NOT NULL DEFAULT -1`);
  await pool.query(`CREATE TABLE IF NOT EXISTS auth_login_attempts(
    subject_hash VARCHAR(64) PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,
    first_failed_at TIMESTAMP NOT NULL DEFAULT NOW(),last_failed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    blocked_until TIMESTAMP,atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_auth_login_attempts_cleanup ON auth_login_attempts(atualizado_em)`);})().catch(e=>{schemaReady=null;throw e});
  return schemaReady;
}

function loginSubjectHash(email){
  // LOGIN_THROTTLE_SECRET pode ser dedicado; se ausente, deriva uma chave de finalidade
  // a partir do JWT_SECRET, sem reutilizar o segredo JWT diretamente como HMAC de e-mail.
  const root=String(process.env.LOGIN_THROTTLE_SECRET||process.env.JWT_SECRET||'');
  if(!root&&process.env.NODE_ENV==='production')throw new Error('JWT_SECRET ausente para derivar chave de throttle');
  const key=crypto.createHmac('sha256',root||'barberflow-dev-only').update('barberflow:login-throttle:v1').digest();
  const raw=String(email||'').trim().toLowerCase();
  const subject=raw.length<=160&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)?raw:'__invalid__';
  return crypto.createHmac('sha256',key).update(subject).digest('hex');
}
async function checkLoginThrottle(email,db=pool){
  await ensureAccountSecuritySchema();
  const r=await db.query(`SELECT blocked_until FROM auth_login_attempts WHERE subject_hash=$1`,[loginSubjectHash(email)]);
  const until=r.rows[0]?.blocked_until?new Date(r.rows[0].blocked_until).getTime():0;
  return {blocked:until>Date.now(),retryAfterSeconds:until>Date.now()?Math.max(1,Math.ceil((until-Date.now())/1000)):0};
}
function delayForFailures(n){if(n<5)return 0;if(n===5)return 60;if(n===6)return 120;if(n===7)return 300;if(n===8)return 600;if(n===9)return 900;if(n===10)return 1800;return Math.min(86400,3600*(2**Math.min(4,n-11)))}
async function recordLoginFailure(email){
  await ensureAccountSecuritySchema();const hash=loginSubjectHash(email),db=await pool.connect();
  try{await db.query('BEGIN');const r=await db.query(`SELECT failures,last_failed_at FROM auth_login_attempts WHERE subject_hash=$1 FOR UPDATE`,[hash]);const recent=r.rowCount&&Date.now()-new Date(r.rows[0].last_failed_at).getTime()<30*60*1000;const failures=recent?Number(r.rows[0].failures||0)+1:1,delay=delayForFailures(failures);await db.query(`INSERT INTO auth_login_attempts(subject_hash,failures,first_failed_at,last_failed_at,blocked_until,atualizado_em) VALUES($1,$2,NOW(),NOW(),CASE WHEN $3::int>0 THEN NOW()+($3*INTERVAL '1 second') ELSE NULL END,NOW()) ON CONFLICT(subject_hash) DO UPDATE SET failures=EXCLUDED.failures,first_failed_at=CASE WHEN $4 THEN auth_login_attempts.first_failed_at ELSE NOW() END,last_failed_at=NOW(),blocked_until=EXCLUDED.blocked_until,atualizado_em=NOW()`,[hash,failures,delay,recent]);await db.query('COMMIT');return {failures,blocked:delay>0,retryAfterSeconds:delay}}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
async function clearLoginFailures(email,db=pool){await ensureAccountSecuritySchema();await db.query(`DELETE FROM auth_login_attempts WHERE subject_hash=$1`,[loginSubjectHash(email)])}
async function verifyAndConsumeTotp(usuarioId,secret,code,db=pool){const step=matchingTotpStep(secret,code);if(step===null)return false;const r=await db.query(`UPDATE usuarios SET mfa_last_used_step=$1 WHERE id=$2 AND COALESCE(mfa_last_used_step,-1)<$1 RETURNING id`,[step,usuarioId]);return r.rowCount===1}

module.exports={ensureAccountSecuritySchema,loginSubjectHash,checkLoginThrottle,recordLoginFailure,clearLoginFailures,verifyAndConsumeTotp,delayForFailures};
