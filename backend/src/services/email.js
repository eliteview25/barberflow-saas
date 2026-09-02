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

async function sendTenantDeletionEmail({to,nome,barbearia,token,expiresAt}){
  const base=String(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
  const link=`${base}/restaurar-conta.html?token=${encodeURIComponent(token)}`;
  const prazo=expiresAt?new Date(expiresAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'30 dias';
  return sendEmail({
    to,
    subject:'Exclusão da sua barbearia agendada no EliteFlow',
    html:`<p>Olá, ${htmlEscape(nome||'proprietário')}.</p><p>A barbearia <strong>${htmlEscape(barbearia||'')}</strong> foi desativada e teve a exclusão definitiva agendada para ${htmlEscape(prazo)}.</p><p>A cobrança recorrente foi interrompida e os acessos foram encerrados. Pagamentos já realizados não são reembolsados automaticamente.</p><p>Se isso foi um engano, restaure a barbearia dentro do prazo:</p><p><a href="${htmlEscape(link)}">Restaurar minha barbearia</a></p><p>O link é individual, de uso único e expira junto com o prazo de recuperação. Se você não solicitou esta ação, restaure a conta e contate o suporte imediatamente.</p>`
  });
}

async function sendTenantRestoredEmail({to,nome,barbearia}){
  const base=String(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
  return sendEmail({
    to,
    subject:'Sua barbearia foi restaurada no EliteFlow',
    html:`<p>Olá, ${htmlEscape(nome||'proprietário')}.</p><p>A barbearia <strong>${htmlEscape(barbearia||'')}</strong> foi restaurada com sucesso.</p><p>Os acessos que haviam sido desativados pela solicitação foram liberados novamente. A assinatura permanece cancelada por segurança; entre no EliteFlow para reativar um plano antes de voltar a usar os recursos pagos.</p><p><a href="${htmlEscape(`${base}/login.html`)}">Entrar no EliteFlow</a></p>`
  });
}

module.exports={sendEmail,sendVerificationEmail,sendTenantDeletionEmail,sendTenantRestoredEmail,htmlEscape};
