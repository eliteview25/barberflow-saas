if(currentUser().papel==='super_admin'){
  location.href='/master.html';
}else if(requireAuth()){
  document.getElementById('shell').innerHTML=renderShell('dashboard');
  const u=currentUser();let revenueState=null,revenuePeriod='diario';
  async function loadOnboarding(){
    if(!['dono','gerente'].includes(u.papel))return;
    try{
      const o=await api('/onboarding');const panel=document.getElementById('onboardingPanel');if(!panel)return;
      panel.classList.toggle('hidden',o.completo);onboardingPercent.textContent=`${o.progresso}%`;onboardingCount.textContent=`${o.concluidas}/${o.total}`;onboardingBar.style.width=`${o.progresso}%`;onboardingPublic.href=o.public_url;
      onboardingSteps.innerHTML=o.steps.map((x,i)=>`<a class="onboarding-step ${x.concluido?'done':''}" href="${esc(x.href)}" ${x.id==='publicar'?'target="_blank" rel="noopener"':''}><span class="onboarding-step-num">${x.concluido?'✓':i+1}</span><div><strong>${esc(x.titulo)}</strong><small>${esc(x.descricao)}</small></div><b>→</b></a>`).join('');
      onboardingShared.disabled=!!o.steps.find(x=>x.id==='publicar')?.concluido;onboardingShared.textContent=onboardingShared.disabled?'Link compartilhado ✓':'Já compartilhei o link';
    }catch(e){console.error('onboarding',e)}
  }
  document.getElementById('onboardingShared')?.addEventListener('click',async()=>{try{await api('/onboarding/link-compartilhado',{method:'POST'});await loadOnboarding()}catch(e){alert(e.message)}});

  function renderRevenueChart(){
    if(!revenueState)return;const items=revenueState.series?.[revenuePeriod]||[],max=Math.max(1,...items.map(x=>Number(x.total||0)));const chart=document.getElementById('dashboardRevenueChart');if(!chart)return;
    chart.innerHTML=items.length?`<div class="dashboard-chart-columns">${items.map(x=>{const val=Number(x.total||0),h=val>0?Math.max(6,val/max*100):2;return `<div class="dashboard-chart-col" title="${esc(x.label)}: ${money(val)}"><div class="dashboard-chart-value">${money(val)}</div><div class="dashboard-chart-bar-wrap"><i style="height:${h}%"></i></div><span>${esc(x.label)}</span></div>`}).join('')}</div>`:'<p class="muted">Ainda sem faturamento para exibir.</p>';
    document.querySelectorAll('[data-revenue-period]').forEach(b=>b.classList.toggle('active',b.dataset.revenuePeriod===revenuePeriod));
  }
  async function loadRevenue(){
    if(!['dono','gerente'].includes(u.papel))return;
    if(!hasFeature('financeiro_basico')){document.getElementById('dashboardRevenueLocked')?.classList.remove('hidden');return}
    try{
      revenueState=await api('/financeiro/dashboard');document.getElementById('dashboardRevenue')?.classList.remove('hidden');
      revHoje.textContent=money(revenueState.totais.hoje);revSemana.textContent=money(revenueState.totais.semana);revMes.textContent=money(revenueState.totais.mes);revAno.textContent=money(revenueState.totais.ano);renderRevenueChart();
    }catch(e){console.error('dashboard revenue',e)}
  }
  document.getElementById('dashboardRevenueTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-revenue-period]');if(!b)return;revenuePeriod=b.dataset.revenuePeriod;renderRevenueChart()});

  (async()=>{
    try{
      const d=await api('/dashboard');aHoje.textContent=d.resumo.agendamentos_hoje;clientes.textContent=d.resumo.clientes;barbeiros.textContent=d.resumo.barbeiros;servicos.textContent=d.resumo.servicos;
      proximos.innerHTML=d.proximos.length?d.proximos.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${timeBR(x.horario)}</td><td>${esc(x.cliente)}</td><td>${esc(x.barbeiro)}</td><td>${esc(x.servico)}</td><td><span class="badge status-${x.status}">${esc(x.status.replace('_',' '))}</span></td></tr>`).join(''):'<tr><td colspan="6">Nenhum próximo agendamento.</td></tr>';
      const c=await api('/configuracoes');publicLink.href=`/agendar/${c.barbearia.slug}`;await Promise.all([loadOnboarding(),loadRevenue()]);
    }catch(e){console.error(e)}
  })();
}
