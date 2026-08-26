const {externalSignal}=require('../utils/http');
async function notificar(evento, dados) {
  const url = process.env.AUTOMATION_WEBHOOK_URL;
  if (!url) { if (process.env.NODE_ENV !== 'production') console.log(`[automação:${evento}]`, dados); return; }
  try {
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','x-barberflow-secret':process.env.AUTOMATION_WEBHOOK_SECRET||''}, body:JSON.stringify({evento,dados,ocorreu_em:new Date().toISOString()}), signal:externalSignal() });
  } catch (e) { console.error('Falha ao enviar webhook de automação:', e.message); }
}
module.exports={notificar};
