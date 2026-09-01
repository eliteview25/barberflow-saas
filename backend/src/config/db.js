const { Pool } = require('pg');

const prod=process.env.NODE_ENV==='production';
const dbSsl=/^(?:1|true|require|verify-ca|verify-full)$/i.test(String(process.env.DB_SSL||''));
if(prod&&!dbSsl)throw new Error('DB_SSL=true é obrigatório em produção');

// Render Postgres external connections use TLS with sslmode=require by default.
// In node-postgres, rejectUnauthorized:false is the equivalent compatibility mode:
// traffic remains encrypted, while CA validation is not enforced. Strict CA/hostname
// validation remains available by setting DB_SSL_REJECT_UNAUTHORIZED=true and,
// for private/self-managed CAs, DB_SSL_CA with the PEM certificate.
const explicitReject=process.env.DB_SSL_REJECT_UNAUTHORIZED;
const hasCa=Boolean(process.env.DB_SSL_CA);
const rejectUnauthorized=explicitReject==null||explicitReject===''
  ? hasCa
  : String(explicitReject).toLowerCase()!=='false';

function boundedInt(value,fallback,min,max){const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback}
const ssl=dbSsl?{
  rejectUnauthorized,
  ...(hasCa?{ca:String(process.env.DB_SSL_CA).replace(/\\n/g,'\n')}:{})
}:false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
  max: boundedInt(process.env.DB_POOL_MAX,10,2,100),
  idleTimeoutMillis: boundedInt(process.env.DB_IDLE_TIMEOUT_MS,30000,1000,300000),
  connectionTimeoutMillis: boundedInt(process.env.DB_CONNECT_TIMEOUT_MS,10000,1000,30000),
  statement_timeout: boundedInt(process.env.DB_STATEMENT_TIMEOUT_MS,15000,1000,120000),
  query_timeout: boundedInt(process.env.DB_QUERY_TIMEOUT_MS,20000,1000,180000),
  idle_in_transaction_session_timeout: boundedInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT_MS,15000,1000,120000),
  application_name: 'eliteflow-saas'
});

pool.on('error',(erro)=>{
  console.error(JSON.stringify({nivel:'error',evento:'postgres_pool_error',mensagem:erro.message}));
});

module.exports = pool;
