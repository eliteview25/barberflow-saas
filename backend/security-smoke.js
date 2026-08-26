require('dotenv').config();
const base=String(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
let failures=0;async function check(name,fn){try{await fn();console.log('✅',name)}catch(e){failures++;console.error('❌',name,'-',e.message)}}
async function get(path,opts){return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(10000),...opts})}
(async()=>{
 await check('health live',async()=>{const r=await get('/api/health/live');if(!r.ok)throw new Error('HTTP '+r.status)});
 await check('health ready',async()=>{const r=await get('/api/health/ready');if(!r.ok)throw new Error('HTTP '+r.status)});
 await check('API privada sem sessão retorna 401',async()=>{const r=await get('/api/clientes');if(r.status!==401)throw new Error('esperado 401, recebeu '+r.status)});
 await check('Master sem sessão retorna 401',async()=>{const r=await get('/api/master/dashboard');if(r.status!==401)throw new Error('esperado 401, recebeu '+r.status)});
 await check('CSP e headers de proteção estão presentes',async()=>{const r=await get('/login.html');const c=r.headers.get('content-security-policy')||'';if(!c.includes("script-src 'self'"))throw new Error('CSP ausente/fraca');if(!r.headers.get('x-content-type-options'))throw new Error('nosniff ausente');if(r.headers.get('x-powered-by'))throw new Error('X-Powered-By exposto')});
 await check('Webhook WhatsApp falso não é aceito',async()=>{const r=await get('/api/whatsapp/webhook',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256=00'},body:'{}'});if(![401,503].includes(r.status))throw new Error('esperado 401/503, recebeu '+r.status)});
 await check('Webhook Mercado Pago sem assinatura não é aceito',async()=>{const r=await get('/api/webhooks/mercadopago?data.id=1&type=payment&barbearia_id=1&tenant_sig=00',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(r.status!==401)throw new Error('esperado 401, recebeu '+r.status)});
 await check('Método mutável protegido não aceita sessão inexistente/CSRF vazio',async()=>{const r=await get('/api/clientes',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(r.status!==401)throw new Error('esperado 401, recebeu '+r.status)});
 process.exitCode=failures?1:0;if(!failures)console.log('🔐 Smoke test externo V2 passou.');
})().catch(e=>{console.error(e);process.exitCode=1});
