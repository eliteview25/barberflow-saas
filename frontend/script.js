if(currentUser().papel==='super_admin'){location.href='/master.html'}else if(requireAuth()){
  document.getElementById('shell').innerHTML=renderShell('dashboard');
  const u=currentUser(),role=u.papel;document.body.dataset.role=role;
  const E=id=>document.getElementById(id),phoneDigits=v=>String(v||'').replace(/\D/g,''),waHref=x=>{let p=phoneDigits(x.telefone);if(p.length===10||p.length===11)p='55'+p;return `https://wa.me/${p}`};
  const firstName=String(u.nome||'').trim().split(/\s+/)[0]||'Usuário';
  const hour=new Date().getHours(),hello=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  E('greeting').textContent=`${hello}, ${firstName}! 👋`;
  E('mobileGreeting').textContent=`Olá, ${firstName}`;
  E('mobileOwnerAvatar').innerHTML=userAvatarHtml(u,'mobile-owner');
  const roleCopy={dono:'Aqui está o resumo da sua barbearia hoje.',gerente:'Acompanhe equipe, agenda, caixa e crescimento da barbearia.',recepcao:'Organize a recepção e mantenha o atendimento em dia.',barbeiro:'Sua agenda e seus próximos clientes hoje.'};
  E('dashboardSubtitle').textContent=roleCopy[role]||'Aqui está sua operação hoje.';
  const setIcon=(id,name)=>{const el=E(id);if(el)el.innerHTML=iconSVG(name,20)};
  setIcon('kpiCalendar','calendar');setIcon('kpiRevenue','wallet');setIcon('kpiTicket','users');setIcon('kpiOccupancy','chart');
  if(role==='barbeiro'){E('dashboardPrimaryAction').href='/pages/agendamentos.html';E('dashboardPrimaryAction').textContent='Minha agenda'}

  const initials=name=>String(name||'BF').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  const avatar=(name,url,cls='')=>{const safe=safeClientUrl(url);return `<span class="bf-data-avatar ${cls}">${safe?`<img src="${esc(safe)}" alt="${esc(name||'Profissional')}">`:`<span>${esc(initials(name))}</span>`}</span>`};
  function sparkline(values){const nums=(values||[]).map(x=>Number(x?.total ?? x ?? 0)),w=92,h=30,p=2,max=Math.max(1,...nums),min=Math.min(0,...nums),range=Math.max(1,max-min);if(!nums.length)return '';const pts=nums.map((v,i)=>`${p+(i*(w-p*2)/Math.max(1,nums.length-1))},${h-p-((v-min)/range)*(h-p*2)}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`}
  function compactMoney(v){const n=Number(v||0);return n>=1000?`R$ ${(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})}k`:money(n)}

  function appointmentCard(x){return `<article class="premium-appointment-row"><div class="premium-appointment-time"><strong>${timeBR(x.horario)}</strong><span>${Number(x.duracao||0)}min</span></div>${avatar(x.barbeiro,x.barbeiro_foto,'appointment')}<div class="premium-appointment-client"><strong>${esc(x.cliente)}</strong><span>${esc(x.servico||'Serviço')}</span></div><div class="premium-appointment-barber">${role==='barbeiro'?'Você':esc(x.barbeiro||'')}</div><span class="premium-status status-${esc(x.status)}">${esc(String(x.status||'').replaceAll('_',' '))}</span><a class="appointment-wa" href="${waHref(x)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(x.cliente)}">${iconSVG('whatsapp',17)}</a></article>`}
  function mobileActions(){const items=role==='barbeiro'?[['/pages/agendamentos.html','calendar','Minha agenda'],['/pages/suporte.html','support','Suporte']]:role==='recepcao'?[['/pages/agendamentos.html','calendar','Agenda'],['/pages/clientes.html','users','Clientes'],['/pages/gestao.html?secao=comandas','clipboard','Comandas'],['/pages/suporte.html','support','Suporte']]:[['/pages/agendamentos.html','calendar','Agenda'],['/pages/clientes.html','users','Clientes'],['/pages/servicos.html','scissors','Serviços'],['/pages/financeiro.html','wallet','Financeiro'],['/pages/gestao.html?secao=relatorios','chart','Relatórios'],['/pages/automacoes.html','whatsapp','WhatsApp']];E('mobileActionGrid').innerHTML=items.map(([href,ic,label])=>`<a href="${href}">${iconSVG(ic,22)}<span>${label}</span></a>`).join('')}
  mobileActions();

  async function loadOnboarding(){if(!['dono','gerente'].includes(role))return;try{const o=await api('/onboarding'),panel=E('onboardingPanel');if(!panel)return;panel.classList.toggle('hidden',o.completo);E('onboardingPercent').textContent=`${o.progresso}%`;E('onboardingCount').textContent=`${o.concluidas}/${o.total}`;E('onboardingBar').style.width=`${o.progresso}%`;E('onboardingPublic').href=o.public_url;E('onboardingSteps').innerHTML=o.steps.map((x,i)=>`<a class="onboarding-step ${x.concluido?'done':''}" href="${esc(x.href)}" ${x.id==='publicar'?'target="_blank" rel="noopener"':''}><span class="onboarding-step-num">${x.concluido?'✓':i+1}</span><div><strong>${esc(x.titulo)}</strong><small>${esc(x.descricao)}</small></div><b>→</b></a>`).join('');E('onboardingShared').disabled=!!o.steps.find(x=>x.id==='publicar')?.concluido;E('onboardingShared').textContent=E('onboardingShared').disabled?'Link compartilhado ✓':'Já compartilhei o link'}catch(e){console.error('onboarding',e)}}
  E('onboardingShared')?.addEventListener('click',async()=>{try{await api('/onboarding/link-compartilhado',{method:'POST'});await loadOnboarding()}catch(e){console.error(e)}});

  function renderRevenueChart(state){
    const items=state?.series?.diario||[],chart=E('dashboardRevenueChart');
    if(!items.length){chart.innerHTML='<div class="premium-empty">Sem faturamento registrado nos últimos 7 dias.</div>';E('sparkRevenue').innerHTML='';E('revSemana').textContent=money(state?.totais?.semana||0);return}
    const values=items.map(x=>Number(x.total||0)),max=Math.max(1,...values),week=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const labels=items.map((x,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(items.length-1-i));return week[d.getDay()]});
    chart.innerHTML=`<div class="premium-bar-chart" role="img" aria-label="Faturamento dos últimos 7 dias">${items.map((x,i)=>{const v=values[i],height=Math.max(3,Math.round(v/max*100));return `<div class="premium-bar-item"><b class="premium-bar-value">${v?esc(compactMoney(v)):''}</b><div class="premium-bar-track"><i style="height:${height}%" title="${esc(labels[i])} — ${money(v)}"></i></div><span>${esc(labels[i])}</span></div>`}).join('')}</div>`;
    E('sparkRevenue').innerHTML=sparkline(items);E('revSemana').textContent=money(state?.totais?.semana||0)
  }

  function renderBarberPerformance(state){const rows=state?.barbeiros||[],max=Math.max(1,...rows.map(x=>Number(x.total||0)));E('barberPerformance').innerHTML=rows.length?rows.slice(0,5).map((x,i)=>{const total=Number(x.total||0),pct=Math.max(4,total/max*100);return `<div class="barber-performance-row">${avatar(x.nome,x.foto_url,'performance')}<strong>${esc(x.nome)}</strong><div class="barber-performance-track"><i style="width:${pct}%"></i></div><b>${money(total)}</b><span>${i===0&&total>0?'+ destaque':''}</span></div>`}).join(''):'<div class="premium-empty">Os resultados dos barbeiros aparecerão após os primeiros atendimentos concluídos.</div>'}

  function applyRoleMetrics(d,revenue){const r=d.resumo||{};if(['dono','gerente'].includes(role)){E('aHoje').textContent=r.agendamentos_hoje||0;E('receitaHoje').textContent=money(revenue?.totais?.hoje??r.faturamento_hoje);E('ticketMedio').textContent=r.clientes||0;E('ocupacaoHoje').textContent=`${r.ocupacao_hoje||0}%`;E('agendaHint').textContent='Atendimentos programados';E('receitaHint').textContent='Faturamento consolidado hoje';E('ticketHint').textContent='Clientes cadastrados';E('ocupacaoHint').textContent='Capacidade da equipe';E('sparkAppointments').innerHTML=sparkline(d.tendencias?.agendamentos);E('sparkClients').innerHTML=sparkline(d.tendencias?.clientes);E('occupancyRing').style.setProperty('--pct',`${Math.max(0,Math.min(100,Number(r.ocupacao_hoje||0)))}%`)}else if(role==='recepcao'){E('aHoje').textContent=r.agendamentos_hoje||0;E('receitaHoje').textContent=r.confirmados_hoje||0;E('kpiRevenueLabel').textContent='Confirmados';E('ticketMedio').textContent=r.em_atendimento_hoje||0;E('kpiTicketLabel').textContent='Em atendimento';E('ocupacaoHoje').textContent=r.atrasados_hoje||0;E('kpiOccupancyLabel').textContent='Atrasados';E('sparkAppointments').innerHTML=sparkline(d.tendencias?.agendamentos)}else{const next=d.proximos?.[0];E('aHoje').textContent=r.agendamentos_hoje||0;E('receitaHoje').textContent=next?timeBR(next.horario):'—';E('kpiRevenueLabel').textContent='Próximo horário';E('ticketMedio').textContent=r.concluidos_hoje||0;E('kpiTicketLabel').textContent='Concluídos';E('ocupacaoHoje').textContent=money(r.comissao_hoje||0);E('kpiOccupancyLabel').textContent='Comissão hoje';E('sparkAppointments').innerHTML=sparkline(d.tendencias?.agendamentos)}}

  (async()=>{try{
    const [d,revenue]=await Promise.all([api('/dashboard'),['dono','gerente'].includes(role)&&hasFeature('financeiro_basico')?api('/financeiro/dashboard').catch(()=>null):Promise.resolve(null)]);
    applyRoleMetrics(d,revenue);
    E('proximosCards').innerHTML=d.proximos?.length?d.proximos.map(appointmentCard).join(''):`<div class="premium-empty"><strong>Agenda livre</strong><span>Nenhum próximo atendimento neste momento.</span></div>`;
    const next=d.proximos?.[0];if(next){E('mobileNextTime').textContent=`Hoje • ${timeBR(next.horario)}`;E('mobileNextClient').textContent=`${next.cliente} · ${next.servico}`}else{E('mobileNextTime').textContent='Agenda livre';E('mobileNextClient').textContent='Nenhum cliente próximo.'}
    E('mobileSummaryAppointments').textContent=d.resumo?.agendamentos_hoje||0;
    if(role==='recepcao'){E('mobileSummaryClients').textContent=d.resumo?.confirmados_hoje||0;E('mobileSummarySecondLabel').textContent='Confirmados';E('mobileSummaryRevenue').textContent=d.resumo?.atrasados_hoje||0;E('mobileSummaryThirdLabel').textContent='Atrasados'}
    else if(role==='barbeiro'){E('mobileSummaryClients').textContent=d.resumo?.concluidos_hoje||0;E('mobileSummarySecondLabel').textContent='Concluídos';E('mobileSummaryRevenue').textContent=money(d.resumo?.comissao_hoje||0);E('mobileSummaryThirdLabel').textContent='Comissão'}
    else{E('mobileSummaryClients').textContent=d.resumo?.clientes||0;E('mobileSummaryRevenue').textContent=compactMoney((revenue?.totais?.hoje ?? d.resumo?.faturamento_hoje ?? 0))}
    if(revenue){renderRevenueChart(revenue);renderBarberPerformance(revenue)}else{E('dashboardRevenue').classList.add('dashboard-no-finance');E('barberPerformance').innerHTML='<div class="premium-empty">Dados financeiros disponíveis para gestão.</div>'}
    await loadOnboarding();
  }catch(e){console.error('dashboard',e)}})();
}
