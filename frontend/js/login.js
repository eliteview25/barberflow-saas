const form=document.getElementById('form'),msg=document.getElementById('msg'),mfaBox=document.getElementById('mfaLoginBox'),mfaCode=document.getElementById('mfa_code'),submitBtn=document.getElementById('loginSubmit');
senha.maxLength=72;
let waitingMfa=false;
if(currentUser().id)location.replace(currentUser().papel==='super_admin'?'/master.html':'/');
async function finishLogin(d){localStorage.setItem('bf_user',JSON.stringify(d.usuario));if(d.barbearia)localStorage.setItem('bf_barbearia',JSON.stringify(d.barbearia));if(d.assinatura)localStorage.setItem('bf_assinatura',JSON.stringify(d.assinatura));location.replace(d.usuario.papel==='super_admin'?'/master.html':'/')}
function setMfaStep(on){waitingMfa=!!on;mfaBox.classList.toggle('hidden',!waitingMfa);mfaCode.required=waitingMfa;email.readOnly=waitingMfa;senha.readOnly=waitingMfa;submitBtn.textContent=waitingMfa?'Confirmar código':'Entrar';if(waitingMfa)setTimeout(()=>mfaCode.focus(),0)}
async function doLogin(){
  const code=waitingMfa?String(mfaCode.value||'').replace(/\D/g,'').slice(0,6):'';
  if(waitingMfa&&code.length!==6)throw new Error('Digite o código de 6 dígitos do autenticador');
  const r=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value,senha:senha.value,mfa_code:code})});
  const d=await r.json();
  if(r.status===428&&d.mfa_required){if(waitingMfa){mfaCode.value='';flash(msg,d.erro||'Código inválido','error');setTimeout(()=>mfaCode.focus(),0);return}setMfaStep(true);flash(msg,'Digite o código de 6 dígitos do seu aplicativo autenticador.','success');return}
  if(r.status===428&&d.mfa_setup_required){
    const sr=await fetch('/api/auth/mfa/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setup_token:d.setup_token})});
    const sd=await sr.json();if(!sr.ok)throw new Error(sd.erro);
    let confirmed=null;
    await securityChallenge({mode:'totp',title:'Proteja o acesso Supermaster',subtitle:'O 2FA é obrigatório para esta conta. Adicione a chave abaixo no seu aplicativo autenticador e confirme o código gerado.',secret:sd.secret,confirmLabel:'Ativar 2FA e entrar',note:'A nova chave só será ativada depois que o código correto for confirmado.',onConfirm:async setupCode=>{const cr=await fetch('/api/auth/mfa/confirm',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({setup_token:d.setup_token,code:setupCode})});const cd=await cr.json();if(!cr.ok)throw new Error(cd.erro||'Não foi possível confirmar o 2FA');confirmed=cd;return true}});
    return finishLogin(confirmed);
  }
  if(!r.ok){if(d.email_verification_required){location.assign(`/verificar-email.html?email=${encodeURIComponent(String(email.value||'').trim())}`);return}if(waitingMfa&&r.status===401){mfaCode.value='';setTimeout(()=>mfaCode.focus(),0)}throw new Error(d.erro)}
  return finishLogin(d)
}
mfaCode?.addEventListener('input',()=>{mfaCode.value=String(mfaCode.value||'').replace(/\D/g,'').slice(0,6)});
form.addEventListener('submit',async e=>{e.preventDefault();try{submitBtn.disabled=true;await doLogin()}catch(err){flash(msg,err.message,'error')}finally{submitBtn.disabled=false}});

document.getElementById('showPassword')?.addEventListener('change',e=>{senha.type=e.target.checked?'text':'password'});
