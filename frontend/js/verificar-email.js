(()=>{
  const msg=document.getElementById('msg'),button=document.getElementById('confirmarEmail');
  const params=new URLSearchParams(location.search),token=String(params.get('token')||''),email=String(params.get('email')||'');
  async function verify(){
    button.disabled=true;
    try{const r=await fetch('/api/auth/verificar-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Link inválido ou expirado');msg.textContent=d.mensagem;msg.className='notice success';button.hidden=true;setTimeout(()=>location.replace('/login.html?email_verificado=1'),1200)}catch(e){msg.textContent=e.message;msg.className='notice error';button.hidden=false;button.textContent='Tentar novamente'}finally{button.disabled=false}
  }
  async function resend(){button.disabled=true;try{const r=await fetch('/api/auth/reenviar-verificacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível reenviar');msg.textContent=d.mensagem;msg.className='notice success'}catch(e){msg.textContent=e.message;msg.className='notice error'}finally{button.disabled=false}}
  if(/^[A-Za-z0-9_-]{40,100}$/.test(token)){button.hidden=false;button.textContent='Confirmar meu e-mail';button.onclick=verify;verify()}
  else if(email){msg.textContent='Enviamos um link de confirmação. Verifique sua caixa de entrada e o spam.';msg.className='notice success';button.hidden=false;button.textContent='Reenviar link';button.onclick=resend}
  else{msg.textContent='Abra o link recebido por e-mail para confirmar sua conta.';msg.className='notice'}
})();
