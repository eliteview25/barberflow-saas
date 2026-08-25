require('dotenv').config();
const prod=process.env.NODE_ENV==='production';
const required=['JWT_SECRET','DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','APP_URL'];
const premium=['APP_SECRETS_ENCRYPTION_KEY','CRON_SECRET'];
let fail=0;
function erro(msg){console.error(`❌ ${msg}`);fail++}
function ok(msg){console.log(`✅ ${msg}`)}
function aviso(msg){console.warn(`⚠️ ${msg}`)}
for(const k of required){if(!process.env[k])erro(`${k} ausente`);else ok(k)}
for(const k of premium){if(!process.env[k])aviso(`${k} ausente (necessário para WhatsApp/automações)`);else ok(k)}
if(prod&&process.env.JWT_SECRET&&process.env.JWT_SECRET.length<32)erro('JWT_SECRET curto para produção');
if(prod&&process.env.APP_SECRETS_ENCRYPTION_KEY&&process.env.APP_SECRETS_ENCRYPTION_KEY.length<32)erro('APP_SECRETS_ENCRYPTION_KEY curto para produção');
if(prod&&process.env.CRON_SECRET&&process.env.CRON_SECRET.length<24)erro('CRON_SECRET curto para produção');
if(prod&&process.env.APP_URL&&!String(process.env.APP_URL).startsWith('https://'))erro('APP_URL deve usar HTTPS em produção');
if(prod&&process.env.BOOTSTRAP_ADMIN_PASSWORD==='TroqueEstaSenha123!')erro('BOOTSTRAP_ADMIN_PASSWORD ainda usa valor padrão');
if(prod&&process.env.MASTER_ADMIN_PASSWORD==='BarberMaster2026')erro('MASTER_ADMIN_PASSWORD usa senha temporária conhecida');
if(!process.env.CLOUDINARY_CLOUD_NAME)aviso('Cloudinary não configurado: upload direto de logo/banner ficará indisponível.');
if(!process.env.EVOLUTION_API_URL||!process.env.EVOLUTION_API_KEY)aviso('Evolution API não configurada: conexão WhatsApp por QR ficará indisponível.');
if(prod&&!process.env.MP_WEBHOOK_SECRET)aviso('MP_WEBHOOK_SECRET ausente: valide webhooks do Mercado Pago antes de cobrar clientes reais.');
if(process.env.DB_POOL_MAX&&Number(process.env.DB_POOL_MAX)<2)aviso('DB_POOL_MAX muito baixo para uso real.');
process.exitCode=fail?1:0;
