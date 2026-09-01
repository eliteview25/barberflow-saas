const {externalSignal}=require('../utils/http');

function htmlEscape(value){
  return String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

async function sendEmail({to,subject,html}){
  const apiKey=String(process.env.RESEND_API_KEY||'').trim();
  const from=String(process.env.EMAIL_FROM||'').trim();
  if(!apiKey||!from){
    if(process.env.NODE_ENV==='production')throw new Error('Serviço de e-mail não configurado');
    console.log(`E-mail DEV simulado: ${String(subject).slice(0,120)}`);
    return {development:true};
  }
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:[String(to)],subject:String(subject).slice(0,200),html:String(html)}),
    signal:externalSignal()
  });
  if(!response.ok)throw new Error(`Falha no provedor de e-mail (${response.status})`);
  return {sent:true};
}

async function sendVerificationEmail({to,token}){
  const base=String(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
  const link=`${base}/verificar-email.html?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject:'Confirme seu e-mail no EliteFlow',
    html:`<p>Confirme seu e-mail para ativar o trial Premium de 7 dias.</p><p><a href="${htmlEscape(link)}">Confirmar meu e-mail</a></p><p>O link expira em 24 horas. Se você não criou esta conta, ignore esta mensagem.</p>`
  });
}

module.exports={sendEmail,sendVerificationEmail,htmlEscape};
