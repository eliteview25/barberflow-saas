let lastAlertAt=0;
async function notifyOps(payload){
  const url=String(process.env.ALERT_WEBHOOK_URL||'').trim();
  if(!url)return false;
  try{const u=new URL(url);if(process.env.NODE_ENV==='production'&&u.protocol!=='https:')return false}catch{return false}
  const now=Date.now(),cooldown=Math.max(10000,Number(process.env.ALERT_COOLDOWN_MS||60000));
  if(now-lastAlertAt<cooldown)return false;
  lastAlertAt=now;
  try{
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),5000);
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.ALERT_WEBHOOK_TOKEN?{'Authorization':`Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify({servico:'BarberFlow',ambiente:process.env.NODE_ENV||'development',timestamp:new Date().toISOString(),...payload}),signal:ctrl.signal});
    clearTimeout(timer);return r.ok;
  }catch{return false}
}
module.exports={notifyOps};
