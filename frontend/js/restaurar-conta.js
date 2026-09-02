(()=>{
  const button=document.getElementById('restoreAccountButton'),message=document.getElementById('restoreAccountMessage');
  const token=String(new URLSearchParams(location.search).get('token')||'').trim();
  const valid=/^[A-Za-z0-9_-]{40,100}$/.test(token);
  function show(text,type='error'){message.textContent=text;message.className=`notice ${type}`;message.classList.remove('hidden')}
  if(!valid){button.disabled=true;show('Este link de restauração é inválido. Abra o endereço completo recebido por e-mail.')}
  button.addEventListener('click',async()=>{
    if(!valid)return;
    button.disabled=true;button.textContent='Restaurando...';message.classList.add('hidden');
    try{
      const response=await fetch('/api/auth/restaurar-barbearia',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
      let data={};try{data=await response.json()}catch{}
      if(!response.ok)throw new Error(data.erro||'Não foi possível restaurar a barbearia');
      show(data.mensagem||'Barbearia restaurada com sucesso.','success');button.textContent='Barbearia restaurada';
      setTimeout(()=>location.replace('/login.html?barbearia_restaurada=1'),1800);
    }catch(e){show(e.message);button.disabled=false;button.textContent='Tentar restaurar novamente'}
  });
})();
