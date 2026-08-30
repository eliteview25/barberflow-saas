if(currentUser().papel==='super_admin'){location.href='/master.html'}else if(requireAuth()){
  document.getElementById('shell').innerHTML=renderShell('dashboard');
  const u=currentUser(),role=u.papel;document.body.dataset.role=role;
  let revenueState=null,revenuePeriod='diario';
  const E=id=>document.getElementById(id),phoneDigits=v=>String(v||'').replace(/\D/g,''),waHref=x=>{let p=phoneDigits(x.telefone);if(p.length===10||p.length===11)p='55'+p;return `https://wa.me/${p}`};
  const firstName=String(u.nome||'').split(' ')[0]||'Usuário';
  E('greeting').textContent=`${new Date().getHours()<12?'Bom dia':new Date().getHours()<18?'Boa tarde':'Boa noite'}, ${firstName}`;
  const roleCopy={dono:'Aqui está a visão do negócio, da equipe e da agenda de hoje.',gerente:'Acompanhe equipe, agenda, caixa e crescimento da barbearia.',recepcao:'Organize a recepção e mantenha o fluxo de atendimento em dia.',barbeiro:'Sua agenda, seus clientes e seu desempenho hoje.'};
  E('dashboardSubtitle').textContent=roleCopy[role]||'Aqui está sua operação hoje.';
  const setIcon=(id,name)=>{const el=E(id);if(el)el.innerHTML=iconSVG(name,20)};
  setIcon('kpiCalendar','calendar');setIcon('kpiRevenue','wallet');setIcon('kpiTicket','receipt');setIcon('kpiOccupancy','trend');

  function configurePrimaryAction(){const a=E('dashboardPrimaryAction');if(!a)return;if(role==='barbeiro'){a.href='/pages/agendamentos.html';a.textContent='Minha agenda';a.classList.add('dashboard-action-agenda');return}a.href='/pages/agendamentos.html#novo';a.textContent='+ Novo agendamento'}
  configurePrimaryAction();

  async function loadOnboarding(){if(!['dono','gerente'].includes(role))return;try{const o=await api('/onboarding'),panel=E('onboardingPanel');if(!panel)return;panel.classList.toggle('hidden',o.completo);E('onboardingPercent').textContent=`${o.progresso}%`;E('onboardingCount').textContent=`${o.concluidas}/${o.total}`;E('onboardingBar').style.width=`${o.progresso}%`;E('onboardingPublic').href=o.public_url;E('onboardingSteps').innerHTML=o.steps.map((x,i)=>`<a class="onboarding-step ${x.concluido?'done':''}" href="${esc(x.href)}" ${x.id==='publicar'?'target="_blank" rel="noopener"':''}><span class="onboarding-step-num">${x.concluido?'✓':i+1}</span><div><strong>${esc(x.titulo)}</strong><small>${esc(x.descricao)}</small></div><b>→</b></a>`).join('');E('onboardingShared').disabled=!!o.steps.find(x=>x.id==='publicar')?.concluido;E('onboardingShared').textContent=E('onboardingShared').disabled?'Link compartilhado ✓':'Já compartilhei o link'}catch(e){console.error('onboarding',e)}}
  E('onboardingShared')?.addEventListener('click',async()=>{try{await api('/onboarding/link-compartilhado',{method:'POST'});await loadOnboarding()}catch(e){console.error(e)}});

  function renderRevenueChart(){if(!revenueState)return;const items=revenueState.series?.[revenuePeriod]||[],max=Math.max(1,...items.map(x=>Number(x.total||0))),chart=E('dashboardRevenueChart');if(!chart)return;chart.innerHTML=items.length?`<div class="dashboard-chart-columns">${items.map(x=>{const val=Number(x.total||0),h=val>0?Math.max(6,val/max*100):2;return `<div class="dashboard-chart-col" title="${esc(x.label)}: ${money(val)}"><div class="dashboard-chart-value">${money(val)}</div><div class="dashboard-chart-bar-wrap"><i style="height:${h}%"></i></div><span>${esc(x.label)}</span></div>`}).join('')}</div>`:'<p class="muted">Ainda sem faturamento para exibir.</p>';document.querySelectorAll('[data-revenue-period]').forEach(b=>b.classList.toggle('active',b.dataset.revenuePeriod===revenuePeriod))}
  async function loadRevenue(){if(!['dono','gerente'].includes(role)||!hasFeature('financeiro_basico'))return;try{revenueState=await api('/financeiro/dashboard');E('dashboardRevenue')?.classList.remove('hidden');E('revHoje').textContent=money(revenueState.totais.hoje);E('revSemana').textContent=money(revenueState.totais.semana);E('revMes').textContent=money(revenueState.totais.mes);E('revAno').textContent=money(revenueState.totais.ano);renderRevenueChart()}catch(e){console.error('dashboard revenue',e)}}
  E('dashboardRevenueTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-revenue-period]');if(!b)return;revenuePeriod=b.dataset.revenuePeriod;renderRevenueChart()});

  function appointmentCard(x){const secondary=role==='barbeiro'?`${esc(x.servico)} • ${Number(x.duracao||0)} min`:`${esc(x.servico)} • ${esc(x.barbeiro)}`;return `<article class="dashboard-appointment"><div class="dashboard-appointment-time"><strong>${timeBR(x.horario)}</strong><span>${dateBR(x.data)}</span></div><div class="dashboard-appointment-main"><div><strong>${esc(x.cliente)}</strong><span>${secondary}</span></div><span class="badge status-${x.status}">${esc(String(x.status||'').replaceAll('_',' '))}</span></div><a class="appointment-wa" href="${waHref(x)}" target="_blank" rel="noopener" title="Falar no WhatsApp" aria-label="Falar com ${esc(x.cliente)} no WhatsApp">${iconSVG('whatsapp',16)}</a></article>`}
  const insight=(icon,title,text,href)=>({icon,title,text,href});
  function renderInsights(d){
    const r=d.resumo,ins=[];
    if(role==='recepcao'){
      if(Number(r.atrasados_hoje)>0)ins.push(insight('clock',`${r.atrasados_hoje} cliente${Number(r.atrasados_hoje)===1?'':'s'} em atraso`,'Confira quem ainda não iniciou o atendimento.','/pages/agendamentos.html'));
      if(Number(r.aguardando_confirmacao)>0)ins.push(insight('message',`${r.aguardando_confirmacao} aguardando confirmação`,'Vale confirmar os próximos horários para reduzir faltas.','/pages/agendamentos.html'));
      if(Number(r.em_atendimento_hoje)>0)ins.push(insight('scissors',`${r.em_atendimento_hoje} em atendimento`,'Acompanhe comandas e próximos clientes.','/pages/gestao.html?secao=comandas'));
      if(!ins.length)ins.push(insight('sparkle','Recepção em dia','Nenhum atraso ou pendência importante neste momento.','/pages/agendamentos.html'));
    }else if(role==='barbeiro'){
      const next=d.proximos?.[0];
      if(next)ins.push(insight('clock',`Próximo às ${timeBR(next.horario)}`,`${next.cliente} • ${next.servico}.`,'/pages/agendamentos.html'));
      if(Number(r.concluidos_hoje)>0)ins.push(insight('scissors',`${r.concluidos_hoje} concluído${Number(r.concluidos_hoje)===1?'':'s'} hoje`,`Comissão estimada: ${money(r.comissao_hoje)}.`,'/pages/agendamentos.html'));
      if(Number(r.ocupacao_hoje)>=80)ins.push(insight('trend','Dia bem ocupado',`Sua agenda está em ${r.ocupacao_hoje}% de ocupação.`,'/pages/agendamentos.html'));
      if(!ins.length)ins.push(insight('calendar','Agenda tranquila','Você não tem atendimento próximo neste momento.','/pages/agendamentos.html'));
    }else{
      if(Number(r.ocupacao_hoje)<60)ins.push(insight('trend','Agenda com espaço',`Ocupação de ${r.ocupacao_hoje||0}% hoje. Use oportunidades para preencher horários vagos.`,hasFeature('marketing_inteligente')?'/pages/gestao.html?secao=oportunidades':'/pages/agendamentos.html'));
      if(Number(r.atrasados_hoje)>0)ins.push(insight('clock',`${r.atrasados_hoje} atendimento${Number(r.atrasados_hoje)===1?'':'s'} atrasado${Number(r.atrasados_hoje)===1?'':'s'}`,'A recepção pode precisar de atenção.','/pages/agendamentos.html'));
      if(Number(r.agendamentos_hoje)>0)ins.push(insight('calendar',`${r.agendamentos_hoje} atendimento${Number(r.agendamentos_hoje)===1?'':'s'} hoje`, `Receita prevista de ${money(r.receita_prevista_hoje)}.`,'/pages/agendamentos.html'));
      if(!d.proximos.length)ins.push(insight('sparkle','Agenda livre','Não há próximos agendamentos.','/pages/agendamentos.html'));
    }
    E('dashboardInsights').innerHTML=ins.slice(0,3).map(x=>`<a class="dashboard-insight" href="${x.href}"><span>${iconSVG(x.icon,18)}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></div><b>→</b></a>`).join('')
  }
  function renderQuickActions(){
    const items=role==='barbeiro'?
      [['/pages/agendamentos.html','Minha agenda'],['/pages/suporte.html','Suporte']] :
      role==='recepcao'?
      [['/pages/agendamentos.html#novo','Novo agendamento'],['/pages/clientes.html','Clientes'],['/pages/gestao.html?secao=comandas','Comandas'],['/pages/gestao.html?secao=pdv','Caixa / PDV']] :
      [['/pages/gestao.html?secao=comandas','Abrir comandas'],['/pages/agendamentos.html','Agenda completa'],...(hasFeature('marketing_inteligente')?[['/pages/gestao.html?secao=oportunidades','Oportunidades']]:[]),...(hasFeature('automacoes')?[['/pages/automacoes.html','WhatsApp & automações']]:[])];
    E('dashboardQuickActions').innerHTML=items.map(([href,label])=>`<a href="${href}">${esc(label)} <b>→</b></a>`).join('');
  }
  function applyRoleMetrics(d){
    const r=d.resumo,next=d.proximos?.[0];
    if(role==='recepcao'){
      E('kpiCalendarLabel').textContent='Agendamentos hoje';E('aHoje').textContent=r.agendamentos_hoje;E('agendaHint').textContent='Fluxo total do dia';
      E('kpiRevenueLabel').textContent='Confirmados';E('receitaHoje').textContent=r.confirmados_hoje;E('receitaHint').textContent='Clientes confirmados';setIcon('kpiRevenue','shield');
      E('kpiTicketLabel').textContent='Em atendimento';E('ticketMedio').textContent=r.em_atendimento_hoje;E('ticketHint').textContent='Atendimentos em andamento';setIcon('kpiTicket','scissors');
      E('kpiOccupancyLabel').textContent='Atrasados';E('ocupacaoHoje').textContent=r.atrasados_hoje;E('ocupacaoHint').textContent=Number(r.atrasados_hoje)?'Precisam de atenção':'Tudo dentro do horário';setIcon('kpiOccupancy','clock');
      E('scheduleEyebrow').textContent='RECEPÇÃO';E('scheduleTitle').textContent='Próximos clientes';E('scheduleSubtitle').textContent='Quem está chegando e precisa ser recebido.';
    }else if(role==='barbeiro'){
      E('kpiCalendarLabel').textContent='Meus atendimentos';E('aHoje').textContent=r.agendamentos_hoje;E('agendaHint').textContent='Sua agenda de hoje';
      E('kpiRevenueLabel').textContent='Próximo horário';E('receitaHoje').textContent=next?timeBR(next.horario):'—';E('receitaHint').textContent=next?next.cliente:'Agenda livre';setIcon('kpiRevenue','clock');
      E('kpiTicketLabel').textContent='Concluídos hoje';E('ticketMedio').textContent=r.concluidos_hoje;E('ticketHint').textContent=`${money(r.faturamento_hoje)} em serviços`;setIcon('kpiTicket','scissors');
      E('kpiOccupancyLabel').textContent='Minha comissão';E('ocupacaoHoje').textContent=money(r.comissao_hoje);E('ocupacaoHint').textContent=`${r.ocupacao_hoje||0}% de ocupação`;setIcon('kpiOccupancy','wallet');
      E('scheduleEyebrow').textContent='MINHA AGENDA';E('scheduleTitle').textContent='Próximos clientes';E('scheduleSubtitle').textContent='Atendimentos que vêm a seguir no seu dia.';
    }else{
      E('aHoje').textContent=r.agendamentos_hoje;E('receitaHoje').textContent=money(r.receita_prevista_hoje);E('ticketMedio').textContent=money(r.ticket_medio);E('ocupacaoHoje').textContent=`${r.ocupacao_hoje||0}%`;E('ocupacaoHint').textContent=Number(r.ocupacao_hoje)>=80?'Dia bem ocupado':Number(r.ocupacao_hoje)>=50?'Ainda há oportunidades':'Boa margem para preencher a agenda';
      if(role==='gerente'){E('scheduleEyebrow').textContent='OPERAÇÃO';E('scheduleSubtitle').textContent='Próximos clientes para coordenar com a equipe.'}
    }
  }

  (async()=>{try{
    const d=await api('/dashboard');applyRoleMetrics(d);
    E('proximosCards').innerHTML=d.proximos.length?d.proximos.map(appointmentCard).join(''):`<div class="dashboard-empty"><strong>${role==='barbeiro'?'Nenhum próximo atendimento':'Nenhum próximo cliente'}</strong><span>${role==='barbeiro'?'Sua agenda está livre neste momento.':'Crie um agendamento ou use as ações rápidas para movimentar a agenda.'}</span></div>`;
    renderInsights(d);renderQuickActions();
    if(['dono','gerente'].includes(role)){try{const c=await api('/configuracoes');const link=document.createElement('a');link.id='publicLink';link.href=`/agendar/${c.barbearia.slug}`;link.target='_blank';link.rel='noopener';link.innerHTML='Página pública <b>↗</b>';E('dashboardQuickActions').appendChild(link)}catch(e){console.error('public link',e)}}
    await Promise.all([loadOnboarding(),loadRevenue()]);
  }catch(e){console.error(e)}})()
}
