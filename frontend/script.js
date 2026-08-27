if(currentUser().papel==='super_admin'){
  location.href='/master.html';
}else if(requireAuth()){
  document.getElementById('shell').innerHTML=renderShell('dashboard');
  const u=currentUser();
  async function loadOnboarding(){
    if(!['dono','gerente'].includes(u.papel))return;
    try{
      const o=await api('/onboarding');
      const panel=document.getElementById('onboardingPanel');
      if(!panel)return;
      panel.classList.toggle('hidden',o.completo);
      onboardingPercent.textContent=`${o.progresso}%`;
      onboardingCount.textContent=`${o.concluidas}/${o.total}`;
      onboardingBar.style.width=`${o.progresso}%`;
      onboardingPublic.href=o.public_url;
      onboardingSteps.innerHTML=o.steps.map((x,i)=>`<a class="onboarding-step ${x.concluido?'done':''}" href="${esc(x.href)}" ${x.id==='publicar'?'target="_blank" rel="noopener"':''}><span class="onboarding-step-num">${x.concluido?'✓':i+1}</span><div><strong>${esc(x.titulo)}</strong><small>${esc(x.descricao)}</small></div><b>→</b></a>`).join('');
      onboardingShared.disabled=!!o.steps.find(x=>x.id==='publicar')?.concluido;
      onboardingShared.textContent=onboardingShared.disabled?'Link compartilhado ✓':'Já compartilhei o link';
    }catch(e){console.error('onboarding',e)}
  }
  document.getElementById('onboardingShared')?.addEventListener('click',async()=>{try{await api('/onboarding/link-compartilhado',{method:'POST'});await loadOnboarding()}catch(e){alert(e.message)}});
  (async()=>{
    try{
      const d=await api('/dashboard');
      aHoje.textContent=d.resumo.agendamentos_hoje;clientes.textContent=d.resumo.clientes;barbeiros.textContent=d.resumo.barbeiros;servicos.textContent=d.resumo.servicos;faturamento.textContent=money(d.resumo.faturamento_mes);
      proximos.innerHTML=d.proximos.length?d.proximos.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${timeBR(x.horario)}</td><td>${esc(x.cliente)}</td><td>${esc(x.barbeiro)}</td><td>${esc(x.servico)}</td><td><span class="badge status-${x.status}">${esc(x.status.replace('_',' '))}</span></td></tr>`).join(''):'<tr><td colspan="6">Nenhum próximo agendamento.</td></tr>';
      const c=await api('/configuracoes');publicLink.href=`/agendar/${c.barbearia.slug}`;
      await loadOnboarding();
    }catch(e){console.error(e)}
  })();
}
