if(requireAuth(['dono','gerente'])){
  document.getElementById('shell').innerHTML=renderShell('financeiro');
  const user=currentUser();
  if(!hasFeature('financeiro_basico')){
    document.querySelector('main.main').innerHTML='<header class="topbar"><div><h1>Financeiro</h1></div></header><div class="upgrade-card"><strong>🔒 Financeiro indisponível</strong><p>O Financeiro faz parte de todos os planos comerciais ativos.</p><a class="btn btn-primary" href="/pages/assinatura.html">Ver planos</a></div>';
  }else{
    const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1);inicio.value=localISO(first);fim.value=localISO(now);
    const methodLabel=m=>({pix:'Pix',pix_manual:'Pix manual',cartao:'Cartão',dinheiro:'Dinheiro',mercado_pago:'Mercado Pago',nao_informado:'Não informado',outros:'Outros'})[m]||String(m||'Outros').replaceAll('_',' ');
    const originLabel=o=>o==='pdv'?'PDV / Venda':'Atendimento';
    const monthLabel=s=>{const [y,m]=String(s).split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.','')};
    const clampPct=v=>Math.max(0,Math.min(100,Number(v||0)));

    async function load(){
      try{
        const r=await api(`/financeiro?inicio=${encodeURIComponent(inicio.value)}&fim=${encodeURIComponent(fim.value)}`);
        fat.textContent=money(r.total);qtd.textContent=r.quantidade;ticket.textContent=money(r.ticket_medio);
        lista.innerHTML=r.itens.length?r.itens.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${esc(x.cliente)}</td><td>${esc(x.barbeiro)}</td><td><span class="badge finance-origin-${esc(x.origem)}">${originLabel(x.origem)}</span></td><td>${esc(methodLabel(x.forma_pagamento))}</td><td><strong>${money(x.preco)}</strong></td></tr>`).join(''):'<tr><td colspan="6">Nenhuma receita registrada no período.</td></tr>';
      }catch(e){lista.innerHTML=`<tr><td colspan="6">${esc(e.message)}</td></tr>`}
    }

    function renderMonthly(g){
      const max=Math.max(1,...g.mensal.map(x=>Number(x.total||0)));
      return `<article class="finance-chart-card finance-month-chart"><div class="finance-card-head"><div><span class="finance-eyebrow">EVOLUÇÃO</span><h3>Faturamento — últimos 6 meses</h3></div></div><div class="mini-bars">${g.mensal.map(x=>`<div class="mini-bar-row"><span>${esc(monthLabel(x.mes))}</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Math.max(Number(x.total||0)>0?4:0,Number(x.total||0)/max*100)}%"></div></div><strong>${money(x.total)}</strong></div>`).join('')||'<p class="muted">Ainda sem dados.</p>'}</div></article>`;
    }

    function renderPayments(g){
      const total=g.formas.reduce((s,x)=>s+Number(x.total||0),0),max=Math.max(1,...g.formas.map(x=>Number(x.total||0))),pix=Number(g.pix?.total||0),pixPct=total>0?Math.round(pix/total*100):0;
      return `<article class="finance-chart-card"><div class="finance-card-head"><div><span class="finance-eyebrow">FORMAS DE PAGAMENTO</span><h3>Como seus clientes pagaram</h3></div></div><div class="pix-highlight"><div><span>Pix no mês</span><strong>${money(pix)}</strong><small>${Number(g.pix?.quantidade||0)} recebimento(s)</small></div><b>${pixPct}%<small>do faturamento</small></b></div><div class="payment-bars">${g.formas.map(x=>`<div class="payment-bar-row ${x.metodo==='pix'?'is-pix':''}"><div><strong>${esc(methodLabel(x.metodo))}</strong><small>${x.quantidade} registro(s)</small></div><div class="payment-bar-track"><i style="width:${Math.max(Number(x.total||0)>0?5:0,Number(x.total||0)/max*100)}%"></i></div><span>${money(x.total)}</span></div>`).join('')||'<p class="muted">Ainda sem recebimentos neste mês.</p>'}</div>${g.formas.some(x=>x.metodo==='mercado_pago')?'<p class="finance-chart-note">Pagamentos antigos registrados apenas como “Mercado Pago” ficam separados porque o método (Pix/cartão) não era salvo anteriormente. Novos pagamentos passam a registrar essa informação.</p>':''}</article>`;
    }

    function renderRanking(g){
      const rows=g.barbeiros.filter(x=>Number(x.total||0)>0);
      return `<article class="finance-chart-card"><div class="finance-card-head"><div><span class="finance-eyebrow">EQUIPE</span><h3>Ranking de barbeiros — mês atual</h3></div></div><div class="finance-ranking">${rows.map((x,i)=>`<div class="finance-rank-row"><div class="rank-position rank-${i+1}">${i+1}</div><div class="rank-person"><strong>${esc(x.nome)}</strong><small>${x.atendimentos} receita(s) • comissão estimada ${money(x.comissao_estimada)}</small></div><div class="rank-value"><strong>${money(x.total)}</strong><small>faturado</small></div></div>`).join('')||'<p class="muted">Ainda não há faturamento da equipe neste mês.</p>'}</div></article>`;
    }

    function progressBar(value,label=''){return `<div class="goal-progress"><div class="goal-progress-track"><i style="width:${clampPct(value)}%"></i></div><span>${Number(value||0)}%${label?` ${esc(label)}`:''}</span></div>`}
    function renderGoals(m){
      const hasGoal=Number(m.geral.meta||0)>0,done=Number(m.geral.realizado||0);
      return `<article class="finance-chart-card finance-goals-card"><div class="finance-card-head"><div><span class="finance-eyebrow">METAS</span><h3>Meta de faturamento — ${esc(monthLabel(String(m.mes).slice(0,7)))}</h3></div>${user.papel==='dono'?'<button id="configMetas" class="btn btn-secondary" type="button">⚙ Configurar metas</button>':''}</div>${hasGoal?`<div class="goal-main"><div><span>Meta da barbearia</span><strong>${money(m.geral.meta)}</strong><small>Realizado: ${money(done)} • Falta: ${money(Math.max(0,Number(m.geral.meta)-done))}</small></div><b>${m.geral.percentual}%</b></div>${progressBar(m.geral.percentual)}`:`<div class="goal-empty"><strong>Nenhuma meta geral configurada</strong><span>${user.papel==='dono'?'Defina uma meta mensal para acompanhar o ritmo da barbearia.':'O dono ainda não configurou uma meta para este mês.'}</span></div>`}<div class="goal-barbers">${m.barbeiros.filter(x=>Number(x.meta||0)>0).map(x=>`<div class="goal-barber-row"><div><strong>${esc(x.nome)}</strong><small>${money(x.realizado)} de ${money(x.meta)}</small></div>${progressBar(x.percentual)}</div>`).join('')||'<p class="muted">Sem metas individuais de barbeiros neste mês.</p>'}</div></article>`;
    }

    async function graficos(){
      if(!hasFeature('financeiro_graficos')){graficosBox.innerHTML='<div class="upgrade-card"><strong>🔒 Gráficos indisponíveis</strong><p>Os gráficos financeiros fazem parte de todos os planos comerciais ativos.</p><a class="btn btn-primary" href="/pages/assinatura.html">Ver planos</a></div>';return}
      try{
        const mes=monthKey(new Date());const [g,m]=await Promise.all([api('/financeiro/graficos'),api(`/financeiro/metas?mes=${mes}`)]);
        graficosBox.innerHTML=`<div class="finance-analytics-grid">${renderMonthly(g)}${renderPayments(g)}${renderRanking(g)}${renderGoals(m)}</div>`;
        document.getElementById('configMetas')?.addEventListener('click',()=>openGoalsModal(mes));
      }catch(e){graficosBox.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
    }

    async function openGoalsModal(mes){
      try{
        const m=await api(`/financeiro/metas?mes=${encodeURIComponent(mes)}`);document.getElementById('financeGoalModal')?.remove();
        const modal=document.createElement('div');modal.id='financeGoalModal';modal.className='modal';modal.innerHTML=`<div class="modal-box finance-goal-modal"><div class="modal-head"><div><h2>Configurar metas</h2><p class="muted">Metas de faturamento para a barbearia e para cada barbeiro.</p></div><button class="close" type="button" aria-label="Fechar">×</button></div><form id="financeGoalForm"><div class="form-grid"><div class="field"><label>Mês</label><input id="goalMonth" type="month" value="${esc(mes)}" required></div><div class="field"><label>Meta geral da barbearia</label><input id="goalGeneral" type="number" min="0" step="0.01" value="${Number(m.geral.meta||0)}" placeholder="Ex.: 20000"></div></div><div class="goal-form-divider"><strong>Metas individuais</strong><span>Use 0 para deixar o barbeiro sem meta.</span></div><div class="goal-form-barbers">${m.barbeiros.map(x=>`<label class="goal-input-row"><span><strong>${esc(x.nome)}</strong><small>Faturado no mês: ${money(x.realizado)}</small></span><input type="number" min="0" step="0.01" value="${Number(x.meta||0)}" data-goal-barber="${Number(x.id)}"></label>`).join('')||'<p class="muted">Nenhum barbeiro ativo.</p>'}</div><div class="actions finance-goal-actions"><button class="btn btn-secondary" type="button" data-goal-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Salvar metas</button></div></form></div>`;
        document.body.appendChild(modal);document.body.classList.add('modal-open');
        const close=()=>{modal.remove();document.body.classList.remove('modal-open')};modal.querySelector('.close').onclick=close;modal.querySelector('[data-goal-cancel]').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close()});
        goalMonth.onchange=()=>openGoalsModal(goalMonth.value);
        financeGoalForm.onsubmit=async e=>{e.preventDefault();try{const barbeiros=[...modal.querySelectorAll('[data-goal-barber]')].map(i=>({barbeiro_id:Number(i.dataset.goalBarber),valor:Number(i.value||0)}));await api('/financeiro/metas',{method:'PUT',body:JSON.stringify({mes:goalMonth.value,meta_geral:Number(goalGeneral.value||0),barbeiros})});close();await graficos();flash(msg,'Metas salvas com sucesso.')}catch(err){flash(msg,err.message,'error')}};
      }catch(e){flash(msg,e.message,'error')}
    }

    inicio.onchange=fim.onchange=load;load();graficos();
  }
}
