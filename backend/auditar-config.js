try{require('dotenv').config()}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}
const prod=process.env.NODE_ENV==='production';
const required=['JWT_SECRET','DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','APP_URL'];
if(prod)required.push('APP_SECRETS_ENCRYPTION_KEY','BOOKING_OTP_PEPPER','CRON_SECRET','MP_WEBHOOK_TENANT_SECRET','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','RESEND_API_KEY','EMAIL_FROM','DB_SSL');
if(prod&&process.env.WHATSAPP_ENABLED==='true')required.push('META_WHATSAPP_APP_SECRET');
let fail=0;function erro(m){console.error(`❌ ${m}`);fail++}function ok(m){console.log(`✅ ${m}`)}function aviso(m){console.warn(`⚠️ ${m}`)}
for(const k of required){if(!process.env[k])erro(`${k} ausente`);else ok(k)}
function minSecret(k,n=48,{requiredInProd=false}={}){const v=process.env[k];if(!v){if(prod&&requiredInProd)erro(`${k} ausente`);else aviso(`${k} ausente; use segredo separado em produção`);return}if(prod&&v.length<n)erro(`${k} deve ter pelo menos ${n} caracteres`);else ok(k)}
minSecret('JWT_SECRET',48,{requiredInProd:true});
minSecret('APP_SECRETS_ENCRYPTION_KEY',48,{requiredInProd:true});
minSecret('BOOKING_OTP_PEPPER',48,{requiredInProd:true});
minSecret('LOGIN_THROTTLE_SECRET',48);
minSecret('CRON_SECRET',48,{requiredInProd:true});
minSecret('BILLING_WEBHOOK_SECRET',48);
minSecret('MP_WEBHOOK_TENANT_SECRET',48,{requiredInProd:true});
if(process.env.MP_TOKEN_ENCRYPTION_KEY)minSecret('MP_TOKEN_ENCRYPTION_KEY',48);
if(prod&&(process.env.MP_CLIENT_ID||process.env.MP_CLIENT_SECRET||process.env.MP_OAUTH_REDIRECT_URI)){for(const k of ['MP_CLIENT_ID','MP_CLIENT_SECRET','MP_OAUTH_REDIRECT_URI','MP_TOKEN_ENCRYPTION_KEY'])if(!process.env[k])erro(`${k} ausente para Mercado Pago OAuth`);else ok(k)}
if(prod&&process.env.APP_URL){try{const u=new URL(process.env.APP_URL);if(u.protocol!=='https:')erro('APP_URL deve usar HTTPS em produção');if(u.username||u.password)erro('APP_URL não pode conter credenciais')}catch{erro('APP_URL inválida')}}
if(prod&&process.env.MP_OAUTH_REDIRECT_URI){try{const r=new URL(process.env.MP_OAUTH_REDIRECT_URI),a=new URL(process.env.APP_URL);if(r.protocol!=='https:'||r.username||r.password)erro('MP_OAUTH_REDIRECT_URI deve usar HTTPS e não conter credenciais');if(r.origin!==a.origin)erro('MP_OAUTH_REDIRECT_URI deve usar a mesma origem de APP_URL')}catch{erro('MP_OAUTH_REDIRECT_URI inválida')}}
if(prod&&process.env.AUTOMATION_WEBHOOK_URL){try{const u=new URL(process.env.AUTOMATION_WEBHOOK_URL);if(u.protocol!=='https:'||u.username||u.password)erro('AUTOMATION_WEBHOOK_URL deve usar HTTPS e não conter credenciais em produção')}catch{erro('AUTOMATION_WEBHOOK_URL inválida')}}

if(prod&&process.env.MP_ACCESS_TOKEN&&!process.env.MP_PUBLIC_KEY)aviso('MP_PUBLIC_KEY ausente: opcional no checkout externo de assinaturas; mantenha apenas se usar diagnósticos ou integrações que dependam dela');
if(prod&&process.env.ALERT_WEBHOOK_URL){try{const u=new URL(process.env.ALERT_WEBHOOK_URL);if(u.protocol!=='https:'||u.username||u.password)erro('ALERT_WEBHOOK_URL deve usar HTTPS e não conter credenciais em produção')}catch{erro('ALERT_WEBHOOK_URL inválida')}}
if(prod&&process.env.BACKUP_UPLOAD_URL){try{const u=new URL(process.env.BACKUP_UPLOAD_URL);if(u.protocol!=='https:'||u.username||u.password)erro('BACKUP_UPLOAD_URL deve usar HTTPS e não conter credenciais em produção')}catch{erro('BACKUP_UPLOAD_URL inválida')}if(!process.env.BACKUP_ENCRYPTION_KEY||process.env.BACKUP_ENCRYPTION_KEY.length<48)erro('BACKUP_ENCRYPTION_KEY deve ter pelo menos 48 caracteres quando backup remoto estiver ativo')}else if(prod)aviso('BACKUP_UPLOAD_URL ausente: o servidor pode iniciar, mas o job de backup de produção permanecerá indisponível');
if(prod&&!process.env.SUPPORT_EMAIL&&!process.env.SUPPORT_WHATSAPP)aviso('SUPPORT_EMAIL/SUPPORT_WHATSAPP ausentes: suporte funcionará apenas por chamados internos');

for(const k of ['BOOTSTRAP_ADMIN_PASSWORD','MASTER_ADMIN_PASSWORD'])if(prod&&/^CHANGE_ME|TroqueEstaSenha|BarberMaster/i.test(process.env[k]||''))erro(`${k} ainda usa valor de exemplo/temporário`);
if(process.env.ALLOW_PLAN_PRICE_OVERRIDE==='true')for(const [k,def] of [['PLAN_STARTER_PRICE',69.90],['PLAN_PRO_PRICE',119.90],['PLAN_PREMIUM_PRICE',199.90],['PLAN_STARTER_ANNUAL_PRICE',699],['PLAN_PRO_ANNUAL_PRICE',1199],['PLAN_PREMIUM_ANNUAL_PRICE',1999]]){const v=Number(process.env[k]??def);if(!Number.isFinite(v)||v<=0||v>100000)erro(`${k} inválido`)}
if(!process.env.CLOUDINARY_CLOUD_NAME)aviso('Cloudinary não configurado: upload ficará indisponível');
if(!process.env.EVOLUTION_API_URL||!process.env.EVOLUTION_API_KEY)aviso('Evolution API não configurada: QR ficará indisponível');else if(prod){try{const u=new URL(process.env.EVOLUTION_API_URL);if(u.protocol!=='https:'||u.username||u.password)erro('EVOLUTION_API_URL deve usar HTTPS e não conter credenciais em produção')}catch{erro('EVOLUTION_API_URL inválida')}}
if(prod&&process.env.NFSE_API_URL){try{const u=new URL(process.env.NFSE_API_URL);if(u.protocol!=='https:'||u.username||u.password)erro('NFSE_API_URL deve usar HTTPS e não conter credenciais em produção')}catch{erro('NFSE_API_URL inválida')}}
function intRange(k,min,max){if(process.env[k]==null||process.env[k]==='')return;const n=Number(process.env[k]);if(!Number.isInteger(n)||n<min||n>max)erro(`${k} deve ser inteiro entre ${min} e ${max}`)}
intRange('DB_POOL_MAX',2,100);intRange('DB_STATEMENT_TIMEOUT_MS',1000,120000);intRange('DB_QUERY_TIMEOUT_MS',1000,180000);intRange('DB_IDLE_TRANSACTION_TIMEOUT_MS',1000,120000);intRange('EXTERNAL_HTTP_TIMEOUT_MS',1000,30000);intRange('WEBHOOK_MAX_ATTEMPTS',1,50);intRange('WEBHOOK_PROCESSING_STALE_SECONDS',30,3600);intRange('MP_WEBHOOK_MAX_AGE_SECONDS',60,3600);intRange('MAX_BOOKING_DAYS',1,365);intRange('BOOKING_HOLD_MINUTES',5,120);intRange('PUBLIC_OTP_RATE_LIMIT_PER_30_MIN',1,30);intRange('UPLOAD_RATE_LIMIT_PER_10_MIN',1,100);intRange('PUBLIC_CHECKOUT_RATE_LIMIT_PER_10_MIN',3,100);
const fee=Number(process.env.MP_MARKETPLACE_FEE_PERCENT||0);if(!Number.isFinite(fee)||fee<0||fee>30)erro('MP_MARKETPLACE_FEE_PERCENT deve ficar entre 0 e 30');
if(prod&&process.env.PUBLIC_BOOKING_REQUIRE_OTP==='false')erro('PUBLIC_BOOKING_REQUIRE_OTP=false não é permitido em produção');
if(prod&&process.env.REQUIRE_TURNSTILE==='false')erro('REQUIRE_TURNSTILE=false não é permitido em produção');
if(prod&&process.env.ALLOW_LEGACY_PLATFORM_MP_ENV==='true')erro('ALLOW_LEGACY_PLATFORM_MP_ENV=true não é permitido em produção');
if(prod&&String(process.env.DB_SSL).toLowerCase()!=='true')erro('DB_SSL=true é obrigatório em produção');
if(prod&&String(process.env.DB_SSL).toLowerCase()==='true'){const strict=String(process.env.DB_SSL_REJECT_UNAUTHORIZED||'').toLowerCase()==='true'||Boolean(process.env.DB_SSL_CA);if(strict)ok('PostgreSQL TLS com validação de certificado');else aviso('PostgreSQL TLS em modo require: tráfego criptografado, sem validação de CA. Configure DB_SSL_CA + DB_SSL_REJECT_UNAUTHORIZED=true para verify-full.')}
for(const k of ['JWT_SECRET','APP_SECRETS_ENCRYPTION_KEY','BOOKING_OTP_PEPPER','LOGIN_THROTTLE_SECRET','CRON_SECRET','MP_WEBHOOK_TENANT_SECRET','BILLING_WEBHOOK_SECRET','BACKUP_ENCRYPTION_KEY'])if(prod&&process.env[k]&&/change.?me|troque|example|barberflow/i.test(process.env[k]))erro(`${k} parece usar valor previsível/de exemplo`);
if(prod){const keys=['JWT_SECRET','APP_SECRETS_ENCRYPTION_KEY','BOOKING_OTP_PEPPER','LOGIN_THROTTLE_SECRET','CRON_SECRET','MP_WEBHOOK_TENANT_SECRET','BILLING_WEBHOOK_SECRET','BACKUP_ENCRYPTION_KEY'].filter(k=>process.env[k]);if(new Set(keys.map(k=>process.env[k])).size!==keys.length)erro('Cada finalidade sensível configurada deve usar um segredo diferente')}
process.exitCode=fail?1:0;if(!fail)console.log('✅ Configuração passou pelas validações obrigatórias.');
