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
const {ensureStorefrontSchema}=require('./src/services/storefront');
const {ensureStoreCommerceSchema,releaseExpiredStoreOrders}=require('./src/services/storeCommerce');
const {ensureTenantLifecycleSchema,purgeExpiredTenants}=require('./src/services/tenantLifecycle');
const {notifyOps}=require('./src/services/opsAlerts');
const {ensureMarketingSchema,processMarketingCampaigns}=require('./src/services/marketing');
const {ensureWhatsAppProviderSchema}=require('./src/services/whatsappProviders');
const {ensureWhatsAppFlowSchema}=require('./src/services/whatsappFlows');
const {ensureAdvancedOpsSchema}=require('./src/services/advancedOps');
const {ensureBookingTrackingSchema}=require('./src/services/bookingTracking');
const {ensureBarberProfileSchema}=require('./src/services/barberProfiles');
const {ensureBarberScheduleSchema}=require('./src/services/barberSchedule');
const {ensureNotificationSchema}=require('./src/services/notificationCenter');
const PORT=Number(process.env.PORT||3001);
let server;
let encerrando=false;

async function corrigirCompatibilidadeLegada(){
  await pool.query(`ALTER TABLE barbearias ALTER COLUMN email_verificado SET DEFAULT false`);
  const trial=await pool.query(`UPDATE assinaturas a
    SET status='trial',
        inicio=COALESCE(a.inicio,CURRENT_DATE),
        fim_trial=CASE
          WHEN a.fim_trial IS NULL
            THEN CURRENT_DATE+INTERVAL '7 days'
          ELSE a.fim_trial
        END,
        atualizado_em=NOW()
    FROM barbearias b
    WHERE a.barbearia_id=b.id
      AND a.status='trial_pendente'
      AND COALESCE(b.email_verificado,false)=true
    RETURNING a.id`);

  if(trial.rowCount>0)console.log(`Contas verificadas: ${trial.rowCount} trial(s) ativado(s).`);
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
    await ensureStorefrontSchema();
    await ensureStoreCommerceSchema();
    await ensureTenantLifecycleSchema();
    await ensureMarketingSchema();
    await ensureWhatsAppProviderSchema();
    await ensureWhatsAppFlowSchema();
    await ensureAdvancedOpsSchema();
    await ensureBookingTrackingSchema();
    await ensureBarberProfileSchema();
    await ensureBarberScheduleSchema();
    await ensureNotificationSchema();
    const purged=await purgeExpiredTenants();
    if(purged)console.log(`Barbearias expiradas eliminadas permanentemente: ${purged}`);
    console.log('Base de pré-lançamento preparada.');
    console.log('Base de IA preparada.');
    console.log('Checkout de assinatura preparado.');
    console.log('Gateways de pagamento preparados.');
    console.log('Gateways da plataforma preparados.');
    console.log('Catálogo de produtos preparado.');
    console.log('Segurança da conta preparada.');
    console.log('Configurações da plataforma preparadas.');
    console.log('Metas e analytics financeiros preparados.');
    if(process.env.ENABLE_PUBLIC_STORE==='true')console.log('Vitrine online opcional preparada.');
    console.log('Ciclo de exclusão de 30 dias preparado.');
    console.log('Marketing, cupons, públicos e indicações preparados.');
    console.log('Provedores WhatsApp preparados (Meta, 360dialog, Twilio e Evolution).');
    console.log('Construtor de fluxos WhatsApp por barbearia preparado.');
    console.log('Comandas, clube, CRM avançado, pacotes, fila inteligente, BI e fiscal preparados.');
    console.log('Acompanhamento de agendamentos por código e WhatsApp preparado.');
    console.log('Perfis e fotos dos barbeiros preparados.');
    console.log('Expedientes e intervalos dos barbeiros preparados.');
    console.log('Central de notificações preparada.');
    console.log('PostgreSQL conectado!');
    server=app.listen(PORT,()=>{
      console.log(`EliteFlow SaaS: http://localhost:${PORT}`);
      console.log(`Agendamento público: http://localhost:${PORT}/agendar/SEU-SLUG`);
      if(process.env.ENABLE_PUBLIC_STORE==='true')console.log(`Vitrine opcional: http://localhost:${PORT}/loja/SEU-SLUG`);
    });
    const purgeTimer=setInterval(()=>purgeExpiredTenants().catch(e=>console.error('tenant_purge_interval',e.message)),15*60*1000);purgeTimer.unref();
    const storeTimer=setInterval(()=>releaseExpiredStoreOrders().catch(e=>console.error('store_order_expiry',e.message)),5*60*1000);storeTimer.unref();
    const marketingTimer=setInterval(()=>processMarketingCampaigns(2).catch(e=>console.error('marketing_campaign_interval',e.message)),60*1000);marketingTimer.unref();
  }catch(e){
    console.error('Falha ao iniciar: PostgreSQL indisponível:',e.message);
    await notifyOps({nivel:'error',evento:'startup_failed',mensagem:e.message});
    process.exit(1);
  }
}

async function encerrar(sinal){
  if(encerrando)return;
  encerrando=true;
  console.log(`Recebido ${sinal}. Encerrando EliteFlow...`);
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
