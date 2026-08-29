require('dotenv').config();
if(!process.env.JWT_SECRET){console.error('JWT_SECRET não configurado');process.exit(1);}
const app=require('./src/app');
const pool=require('./src/config/db');
const {ensureAiSchema}=require('./src/services/aiConfig');
const {ensureSubscriptionPaymentSchema}=require('./src/services/subscriptionPayments');
const {ensureLaunchSchema,recordSystemEvent}=require('./src/services/launchReadiness');
const {ensurePaymentGatewaySchema}=require('./src/services/paymentGateways');
const {ensureFinanceAnalyticsSchema}=require('./src/services/financeAnalytics');
const {ensurePlatformPaymentGatewaySchema}=require('./src/services/platformPaymentGateways');
const {ensureProductSchema}=require('./src/services/productCatalog');
const {ensureAccountSecuritySchema}=require('./src/services/accountSecurity');
const {ensurePlatformSettingsSchema}=require('./src/services/platformSettings');
const {notifyOps}=require('./src/services/opsAlerts');
const PORT=Number(process.env.PORT||3001);
let server;
let encerrando=false;

async function corrigirCompatibilidadeLegada(){
  // A verificação obrigatória de e-mail foi removida. Esta correção de boot é
  // intencionalmente pequena e idempotente para instalações que já migraram
  // antes dessa regra mudar, mas ficaram com contas em trial_pendente.
  await pool.query(`UPDATE barbearias
    SET email_verificado=true
    WHERE COALESCE(is_system,false)=false
      AND COALESCE(email_verificado,false)=false`);

  const trial=await pool.query(`UPDATE assinaturas
    SET status='trial',
        inicio=COALESCE(inicio,CURRENT_DATE),
        fim_trial=CASE
          WHEN status='trial_pendente' OR fim_trial IS NULL
            THEN CURRENT_DATE+INTERVAL '7 days'
          ELSE fim_trial
        END,
        atualizado_em=NOW()
    WHERE status='trial_pendente'
       OR (status='trial' AND fim_trial IS NULL)
    RETURNING id`);

  if(trial.rowCount>0)console.log(`Compatibilidade legada: ${trial.rowCount} trial(s) liberado(s).`);
}

async function iniciar(){
  try{
    await pool.query('SELECT NOW()');
    await corrigirCompatibilidadeLegada();
    await ensureAiSchema();
    await ensureSubscriptionPaymentSchema();
    await ensureLaunchSchema();
    await ensurePaymentGatewaySchema();
    await ensurePlatformPaymentGatewaySchema();
    await ensureProductSchema();
    await ensureAccountSecuritySchema();
    await ensurePlatformSettingsSchema();
    await ensureFinanceAnalyticsSchema();
    console.log('Base de pré-lançamento preparada.');
    console.log('Base de IA preparada.');
    console.log('Checkout de assinatura preparado.');
    console.log('Gateways de pagamento preparados.');
    console.log('Gateways da plataforma preparados.');
    console.log('Catálogo de produtos preparado.');
    console.log('Segurança da conta preparada.');
    console.log('Configurações da plataforma preparadas.');
    console.log('Metas e analytics financeiros preparados.');
    console.log('PostgreSQL conectado!');
    server=app.listen(PORT,()=>{
      console.log(`BarberFlow SaaS: http://localhost:${PORT}`);
      console.log(`Agendamento público: http://localhost:${PORT}/agendar/SEU-SLUG`);
    });
  }catch(e){
    console.error('Falha ao iniciar: PostgreSQL indisponível:',e.message);
    await notifyOps({nivel:'error',evento:'startup_failed',mensagem:e.message});
    process.exit(1);
  }
}

async function encerrar(sinal){
  if(encerrando)return;
  encerrando=true;
  console.log(`Recebido ${sinal}. Encerrando BarberFlow...`);
  const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
  try{
    if(server) await new Promise(resolve=>server.close(resolve));
    await pool.end();
    clearTimeout(timer);
    process.exit(0);
  }catch(e){console.error('Erro no shutdown:',e.message);process.exit(1);}
}

process.on('SIGTERM',()=>encerrar('SIGTERM'));
process.on('SIGINT',()=>encerrar('SIGINT'));
process.on('unhandledRejection',(e)=>{console.error('Unhandled rejection:',e);recordSystemEvent({nivel:'error',evento:'unhandled_rejection',mensagem:e?.message||String(e)});notifyOps({nivel:'error',evento:'unhandled_rejection',mensagem:e?.message||String(e)});});
process.on('uncaughtException',(e)=>{console.error('Uncaught exception:',e);recordSystemEvent({nivel:'error',evento:'uncaught_exception',mensagem:e?.message||String(e)});notifyOps({nivel:'error',evento:'uncaught_exception',mensagem:e?.message||String(e)});encerrar('uncaughtException')});
iniciar();
