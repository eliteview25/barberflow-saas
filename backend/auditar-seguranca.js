const fs = require('fs');
const path = require('path');
const root = __dirname;
const projectRoot = path.resolve(root, '..');
let fail = 0, warn = 0;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
function ok(m) { console.log('✅', m) }
function bad(m) { console.error('❌', m); fail++ }
function aviso(m) { console.warn('⚠️', m); warn++ }
function check(cond, m) { cond ? ok(m) : bad(m) }
function filesRecursive(dir, exts = /\.(js|html|css|json|md|sql|example)$/i) {
  const out = []; if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name) || e.name === '.env') continue;
    const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...filesRecursive(p, exts)); else if (exts.test(e.name)) out.push(p);
  } return out;
}
const app = read('src/app.js');
const auth = read('src/routes/auth.js');
const mw = read('src/middlewares/auth.js');
const sec = read('src/utils/security.js');
const validation = read('src/utils/validation.js');
const wa = read('src/routes/whatsapp.js');
const mpRoute = read('src/routes/integracoes.js');
const mp = read('src/services/mercadoPago.js');
const oauth = read('src/services/mercadoPagoOAuth.js');
const pub = read('src/routes/publico.js');
const reservations = read('src/services/reservations.js');
const webhook = read('src/services/webhookInbox.js');
const automacoes = read('src/routes/automacoes.js');
const tenant = read('src/routes/tenant.js');
const master = read('src/routes/master.js');
const audit = read('src/services/audit.js');
const agenda = read('src/routes/agendamentos.js');
const clientes = read('src/routes/clientes.js');
const mig = read('migrar-banco.js');
const upload = read('src/routes/uploads.js');
const operacao = read('src/routes/operacao.js');
const aiRoute = read('src/routes/ai.js');
const aiConfig = read('src/services/aiConfig.js');
const aiPolicy = read('src/services/aiPolicy.js');
const subPayments = read('src/services/subscriptionPayments.js');
const paymentGateways = read('src/services/paymentGateways.js');
const paymentsRoute = read('src/routes/pagamentos.js');
const financeAnalytics = read('src/services/financeAnalytics.js');
const marketingRoute = read('src/routes/marketing.js');
const marketingPublic = read('src/routes/marketingPublic.js');
const marketingService = read('src/services/marketing.js');
const whatsappService = read('src/services/whatsapp.js');
const whatsappProviders = read('src/services/whatsappProviders.js');
const storeCommerce = read('src/services/storeCommerce.js');
const pkg = JSON.parse(read('package.json'));
const frontFiles = filesRecursive(path.resolve(root, '../frontend'));
const front = frontFiles.map(p => fs.readFileSync(p, 'utf8')).join('\n');
const runtime = filesRecursive(path.join(root, 'src'), /\.js$/i).map(p => fs.readFileSync(p, 'utf8')).join('\n');

console.log('=== Auditoria estática de regressão de segurança V2 ===');
check(/contentSecurityPolicy\s*:\s*\{/.test(app) && !/contentSecurityPolicy\s*:\s*false/.test(app), 'CSP está habilitada');
check(/bf_session/.test(mw) && /httpOnly\s*:\s*true/.test(sec) && /validateCsrf/.test(mw), 'Sessão usa cookie HttpOnly e CSRF');
check(/token_version/.test(auth) && /token_version/.test(mw), 'Versão de sessão revoga JWTs antigos');
check(/algorithm\s*:\s*['\"]HS256['\"]/.test(auth) && /algorithms\s*:\s*\[\s*['\"]HS256['\"]\s*\]/.test(auth) && /algorithms\s*:\s*\[\s*['\"]HS256['\"]\s*\]/.test(mw), 'JWT fixa explicitamente HS256 em emissão e verificação');
check(/exigirStepUp/.test(master) && /mfa_enabled/.test(auth), 'Supermaster usa MFA + step-up');
check(/if \(usuario\.mfa_enabled\)/.test(auth) && /\/mfa\/enroll/.test(auth) && /\/mfa\/enable/.test(auth) && /encrypt\(secret\)/.test(auth), 'Usuários podem ativar MFA TOTP opcional com segredo criptografado');
check(/\/change-password/.test(auth) && /strongPassword\(novaSenha\)/.test(auth) && /token_version=COALESCE\(token_version,0\)\+1/.test(auth), 'Troca de senha exige senha forte e revoga sessões antigas');
check(/is_system/.test(mig) && /bf_enforce_user_tenant_kind/.test(mig) && /barberflow-system/.test(mig), 'Supermaster está isolado em tenant interno');
check(/audit\(req/.test(master) && /master\.barbearia\.excluida/.test(master) && /master\.senha\.alterada/.test(master) && /safeDetails/.test(audit), 'Ações críticas do Supermaster geram trilha de auditoria sanitizada');
check(/public_token/.test(pub) && !/agendamentos\/:id\/(cancelar|reagendar|avaliar)/.test(pub), 'Self-service público usa token aleatório, não ID sequencial');
check(/otpHash/.test(sec) && /createHmac\(['"]sha256['"]/.test(sec) && /otpHash\(code\)/.test(pub), 'OTP é armazenado com HMAC/pepper');
check(/verifyTurnstile/.test(pub) && /action\s*:\s*['"]public_booking['"]/.test(pub), 'Agenda pública valida Turnstile com action');
check(/booking_otps/.test(pub) && /FOR UPDATE/.test(pub), 'OTP e agenda usam lock transacional');
check(/isoDate/.test(agenda) && /Per[ií]odo|Data inv|status/i.test(agenda), 'Filtros de agenda validam datas/status antes do PostgreSQL');
check(/isoDate/.test(operacao) && /Per[ií]odo inv/i.test(operacao), 'Filtro de comissões valida período');
check(/regexp_replace/.test(clientes) && /409/.test(clientes), 'Cadastro administrativo bloqueia telefone duplicado por tenant');
check(/ux_produtos_tenant_sku_lower/.test(mig), 'SKU de produto é único por tenant de forma case-insensitive');
check(/MP_WEBHOOK_SECRET/.test(app) && /validarWebhook/.test(mpRoute) && /req\.query\[['"]data\.id['"]\]/.test(mpRoute), 'Webhook Mercado Pago usa assinatura e data.id oficial da query');
check(/validarMpTenantSignature/.test(mpRoute) && /mpTenantSignature/.test(mp), 'Roteamento multi-tenant do webhook Mercado Pago tem HMAC próprio');
check(/x-hub-signature-256/.test(wa) && /createHmac\(['"]sha256['"]/.test(wa) && /timingSafeEqual/.test(wa), 'Webhook WhatsApp valida HMAC da Meta');
check(/PROVIDERS=\['meta','360dialog','twilio','evolution'\]/.test(whatsappProviders) && /whatsapp_conexoes/.test(whatsappProviders), 'Central WhatsApp suporta os quatro provedores previstos');
check(/secretValue\?encrypt\(secretValue\)/.test(whatsappProviders) && /webhookToken\?encrypt\(webhookToken\)/.test(whatsappProviders), 'Credenciais e tokens privados dos provedores WhatsApp ficam criptografados');
check(/x-twilio-signature/.test(whatsappProviders) && /timingSafeEqual/.test(whatsappProviders) && /webhook\/twilio\/:token/.test(wa), 'Webhook Twilio valida assinatura e token privado da conexão');
check(/providers\/:provider\/connect'.*exigirStepUp/s.test(wa) && /providers\/:provider\/activate'.*exigirStepUp/s.test(wa) && /delete\('\/providers\/:provider'.*exigirStepUp/s.test(wa), 'Alterações de provedor WhatsApp exigem step-up');
check(/webhook_events/.test(mig) && /ON CONFLICT\(provider,event_id\)/.test(webhook) && /proxima_tentativa/.test(webhook), 'Webhooks usam inbox persistente, idempotência e retry');
check(/WHEN webhook_events\.status IN \('processado','processando','falha_permanente'\) THEN webhook_events\.atualizado_em/.test(webhook), 'Retry duplicado não renova artificialmente claim de webhook em processamento');
check(/paymentMatchesReservation/.test(reservations) && /external_reference/.test(reservations) && /currency/.test(reservations), 'Pagamento é reconciliado por referência, moeda e valor');
check(/mp_payment_id/.test(mig) && /ux_reserva_mp_payment/.test(mig) && /ux_venda_final_agendamento/.test(mig), 'Banco impede pagamento/venda final duplicados');
check(/fk_ag_cliente_tenant/.test(mig) && /fk_venda_cliente_tenant/.test(mig) && /VALIDATE CONSTRAINT/.test(mig), 'FKs compostas multi-tenant são criadas e validadas');
check(/bf_enforce_user_tenant_kind/.test(mig), 'Trigger impede papel Supermaster em tenant de cliente');
check(/ck_vendas_recebimento/.test(mig) && /valor_pre_pago/.test(operacao) && /valor_recebido/.test(operacao), 'PDV separa total, pré-pago e recebido com constraint');
check(/safeCsvCell/.test(validation) && /csvQuote/.test(operacao), 'Exportação CSV neutraliza Formula Injection');
check(/inspectImage/.test(upload) && /fl_strip_profile/.test(upload), 'Upload valida bytes/dimensões e remove metadados');
check(/FOR UPDATE/.test(oauth) && /refreshIntegration\(barbeariaId\)/.test(oauth), 'Refresh OAuth Mercado Pago é serializado');
check(/claimDelivery/.test(automacoes) && /status='processando'/.test(automacoes) && /tentativas/.test(automacoes) && /atualizado_em/.test(automacoes), 'Lembretes têm claim atômico, timestamp próprio e limite de tentativas');
check(/timingSafeText/.test(automacoes) && /x-cron-secret/.test(automacoes), 'Cron usa comparação constante de segredo');
check(/AND c\.barbearia_id=a\.barbearia_id/.test(tenant) && /AND s\.barbearia_id=a\.barbearia_id/.test(tenant), 'Consultas tenant usam joins defensivos por barbearia');
check(!/localStorage\.(getItem|setItem)\(['"](?:token|bf_token|jwt|access_token)/i.test(front), 'Frontend não persiste token de autenticação em localStorage');
check(!Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'multer'), 'Dependência Multer vulnerável/dispensável foi removida do runtime');
check(/feePct>30/.test(mp), 'Taxa marketplace tem teto defensivo de 30% também no runtime');
check(/return `mp:\$\{String\(type\|\|'unknown'\).*:\$\{own\}`/.test(mpRoute), 'Webhook Mercado Pago prioriza ID lógico da notificação para idempotência');
check(!/eval\s*\(|new Function\s*\(/.test(runtime), 'Runtime não usa eval/new Function');
check(/barbearia_id INTEGER PRIMARY KEY REFERENCES barbearias/.test(aiConfig) && /req\.usuario\.barbearia_id/.test(aiRoute), 'Preparação da IA mantém configuração isolada por tenant');
check(/allowedAiTools/.test(aiRoute) && /TOOL_MAP/.test(aiPolicy) && !/SELECT|INSERT|UPDATE|DELETE/i.test(aiPolicy), 'IA futura usa allowlist de ferramentas sem SQL gerado pelo modelo');
check(/motor_ativo:false/.test(aiRoute) && !/router\.post\(['"]\/(?:chat|mensagem|responder)/.test(aiRoute), 'Motor de IA ainda não é exposto antes da integração real');
check(/getPlatformMercadoPagoCredentials/.test(tenant) && /card_token_id/.test(mp) && /sdk\.mercadopago\.com/.test(app), 'Checkout de cartão embutido usa tokenização oficial do Mercado Pago');
check(/qr_code_base64/.test(tenant) && /payment_method_id:'pix'/.test(mp) && /X-Idempotency-Key/.test(mp), 'Checkout Pix da assinatura usa QR interno e idempotência');
check(/barberflow-subscription-pix/.test(subPayments) && /expectedTenantId/.test(subPayments) && /Math\.abs\(amount-Number\(row\.valor\)\)>0\.01/.test(subPayments), 'Pagamento Pix do SaaS reconcilia tenant e valor antes de ativar plano');
check(/atualizarPlanoAssinatura/.test(tenant) && /auto_recurring/.test(mp), 'Migração de plano atualiza assinatura recorrente existente sem duplicar contrato');
check(/secret_enc/.test(paymentGateways) && /encrypt\(JSON\.stringify\(c\.secret\)\)/.test(paymentGateways) && /encrypt\(c\.accessToken\)/.test(paymentGateways), 'Credenciais de gateways manuais são criptografadas no servidor');
check(/exigirPapel\('dono'\)/.test(paymentsRoute) && /exigirRecurso\('pagamentos_online'\)/.test(paymentsRoute), 'Conexão e desconexão de gateways exigem dono e plano compatível');
check(/mercadopago/.test(paymentGateways) && /pagbank/.test(paymentGateways) && /asaas/.test(paymentGateways) && /pagarme/.test(paymentGateways) && /stripe/.test(paymentGateways), 'Catálogo contém os cinco gateways previstos');
check(!paymentsRoute.includes('res.json({secret_enc') && !paymentsRoute.includes('res.json({access_token_enc') && !paymentsRoute.includes('res.json({refresh_token_enc'), 'API de pagamentos não devolve segredos armazenados ao frontend');
check(/metas_financeiras/.test(financeAnalytics) && /barbearia_id=\$1/.test(financeAnalytics) && /exigirPapel\('dono'\).*financeiro\/metas/s.test(tenant), 'Metas financeiras são isoladas por tenant e edição exige dono');
check(/NOT EXISTS\(SELECT 1 FROM vendas v WHERE v\.barbearia_id=a\.barbearia_id AND v\.agendamento_id=a\.id AND v\.status='finalizada'\)/.test(financeAnalytics), 'Analytics financeiro evita dupla contagem entre PDV e agendamento');

check(/exigirRecurso\('marketing'\)/.test(marketingRoute) && /req\.usuario\.barbearia_id/.test(marketingRoute), 'Marketing exige plano compatível e escopo do tenant');
check(/c\.barbearia_id=\$1 AND c\.marketing_opt_in=true/.test(marketingService), 'Públicos de campanha incluem somente clientes com consentimento promocional');
check(/campanhas\/:id\/agendar'.*exigirStepUp/s.test(marketingRoute) && /cupons'.*exigirStepUp/s.test(marketingRoute), 'Envio de campanha e criação de cupons usam step-up de segurança');
check(/validateCoupon/.test(storeCommerce) && /cupom_codigo/.test(storeCommerce) && /recordCouponUse/.test(storeCommerce), 'Cupons são validados e registrados no servidor no checkout da loja');
check(/\^\(sair\|parar/.test(whatsappService) && /marketing_opt_in=false/.test(whatsappService) && /PROMOÇÕES|promoções/.test(whatsappService), 'WhatsApp processa opt-out e reautorização promocional');
check(/updateWhatsAppMarketingStatus/.test(wa) && /statuses/.test(wa) && /provider_message_id/.test(marketingService), 'Webhook WhatsApp rastreia entrega e leitura das campanhas');
check(/urlButtonParam/.test(marketingService) && /sub_type:'url'/.test(whatsappProviders) && app.includes("app.use('/m',marketingLinkLimit,marketingPublic)") && /mkt=/.test(marketingPublic) && /marketing_link_id/.test(marketingService), 'Campanhas suportam botão dinâmico e links rastreáveis com atribuição');
check(/marketingLinkLimit/.test(app) && /MARKETING_LINK_RATE_LIMIT_PER_MINUTE/.test(app), 'Links públicos de Marketing possuem rate limit dedicado');
check(/marketing_opt_in===true/.test(storeCommerce) && /marketing_opt_in_em/.test(storeCommerce), 'Checkout da loja registra consentimento promocional explícito antes da conversão');


const runtimeExternal = ['src/services/mercadoPago.js', 'src/services/mercadoPagoOAuth.js', 'src/services/whatsapp.js', 'src/services/whatsappProviders.js', 'src/services/whatsappQr.js', 'src/services/notifications.js', 'src/services/paymentGateways.js', 'src/routes/publico.js', 'src/routes/uploads.js', 'src/services/storeCommerce.js', 'src/routes/storePublic.js'];
for (const file of runtimeExternal) { const s = read(file); if (/fetch\s*\(/.test(s)) check(/signal\s*:/.test(s), `${file} usa timeout/cancelamento em fetch externo`) }

if (exists('.env')) aviso('.env existe localmente; confirme que continua ignorado pelo Git e não entra no ZIP');
if (!exists('package-lock.json')) aviso('package-lock.json não está nesta cópia; regenere o lockfile no backend antes do deploy'); else ok('package-lock.json presente');

const secretPatterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /APP_USR-[A-Za-z0-9_-]{20,}/,
  /\bEAA[A-Za-z0-9]{50,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@[^\s/]+/i
];

function contentForSecretScan(file, content) {
  // package-lock possui hashes "integrity" grandes.
  // Eles podem parecer tokens para regexes de segurança.
  if (!/package-lock\.json$|npm-shrinkwrap\.json$/i.test(file)) {
    return content;
  }

  try {
    const data = JSON.parse(content);

    function removeIntegrity(value) {
      if (Array.isArray(value)) {
        return value.map(removeIntegrity);
      }

      if (value && typeof value === 'object') {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
          if (key === 'integrity') {
            continue;
          }

          result[key] = removeIntegrity(item);
        }

        return result;
      }

      return value;
    }

    return JSON.stringify(removeIntegrity(data));
  } catch {
    return content.replace(
      /"integrity"\s*:\s*"[^"]+"/g,
      '"integrity":"[omitido]"'
    );
  }
}

let leaked = false;

for (const filePath of filesRecursive(projectRoot)) {
  let content = '';

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  content = contentForSecretScan(filePath, content);

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      console.error(
        '❌ Possível segredo embutido:',
        path.relative(projectRoot, filePath)
      );

      leaked = true;
      break;
    }
  }
}

if (leaked) {
  fail++;
} else {
  ok('Nenhum padrão conhecido de segredo foi encontrado no projeto');
}
console.log(`Resumo: ${fail} falha(s), ${warn} aviso(s).`);
process.exitCode = fail ? 1 : 0;
if (!fail) console.log('🔐 Auditoria estática V2 passou.');
