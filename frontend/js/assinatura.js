if(requireAuth(['dono'])){
  const $=id=>document.getElementById(id);
  $('shell').innerHTML=renderShell('assinatura');
  const els={
    planGrid:$('planGrid'),atual:$('atual'),planoEfetivo:$('planoEfetivo'),statusPlano:$('statusPlano'),proxima:$('proxima'),trial:$('trial'),acoes:$('acoes'),msg:$('msg'),sync:$('sync'),monthly:$('cycleMonthly'),annual:$('cycleAnnual'),modal:$('paymentModal'),paymentTitle:$('paymentTitle'),summary:$('paymentPlanSummary'),payMsg:$('payMsg'),cardBtn:$('payMethodCard'),pixBtn:$('payMethodPix'),cardPanel:$('cardPanel'),pixPanel:$('pixPanel'),close:$('closePayment'),cardCheckout:$('openMercadoPagoCard'),choiceHint:$('paymentChoiceHint'),pixDocumento:$('pixDocumento'),generatePix:$('generatePix'),pixResult:$('pixResult'),pixQr:$('pixQrImage'),pixCode:$('pixCopyCode'),copyPix:$('copyPix'),pixTicket:$('pixTicket'),pixStatus:$('pixLiveStatus'),pixExplainer:$('pixExplainer')
  };
  let assinatura=null,catalogo=[],checkoutConfig=null,selectedPlan=null,pixPollTimer=null,billingCycle='mensal',cardRedirecting=false;

  function store(a){localStorage.setItem('bf_assinatura',JSON.stringify(a||{}))}
  function limiteTexto(p){return p.limite_profissionais==null?'Profissionais ilimitados':`Até ${p.limite_profissionais} profissionais`}
  function planById(id){return catalogo.find(p=>p.id===id)}
  function activeRecurring(){return assinatura?.status==='ativa'&&assinatura?.provedor==='mercadopago'&&assinatura?.provedor_status==='authorized'&&assinatura?.referencia_externa}
  function currentCycle(){return assinatura?.ciclo_cobranca==='anual'?'anual':'mensal'}
  function cycleLabel(c=billingCycle){return c==='anual'?'Anual':'Mensal'}
  function planPrice(p,c=billingCycle){return Number(c==='anual'?p.preco_anual:p.preco_mensal)}
  function isCurrent(p){return assinatura?.status==='ativa'&&!assinatura?.trial_ativo&&assinatura?.plano===p.id&&currentCycle()===billingCycle}
  function ctaText(p){if(isCurrent(p))return 'Plano atual';if(activeRecurring())return assinatura?.plano===p.id?`Trocar para ${cycleLabel()}`:`Migrar para ${p.nome}`;if(assinatura?.status==='ativa'&&assinatura?.provedor==='mercadopago_pix')return assinatura.plano===p.id&&currentCycle()===billingCycle?`Renovar ${p.nome}`:`Trocar para ${p.nome}`;return `Assinar ${p.nome}`}
  function renderCycleToggle(){els.monthly?.classList.toggle('active',billingCycle==='mensal');els.annual?.classList.toggle('active',billingCycle==='anual')}
  function renderCatalog(){
    renderCycleToggle();
    const cards=catalogo.map(p=>{
      const current=isCurrent(p),annual=billingCycle==='anual',price=planPrice(p);
      const sub=annual?`<small class="plan-price-detail">equivale a ${money(p.equivalente_mensal_anual)}/mês</small><span class="plan-save-badge">Economize ${money(p.economia_anual)} por ano</span>`:'';
      return `<article class="plan ${p.id==='pro'?'featured':''} ${current?'plan-current':''}" id="plan-${p.id}"><span class="plan-badge">${esc(p.badge)}</span><h2>${esc(p.nome)}${p.id==='premium'?' 🤖':''}</h2><h3>${money(price)}<small>/${annual?'ano':'mês'}</small></h3>${sub}<p class="muted">${esc(p.descricao)}</p><div class="plan-limit">${esc(limiteTexto(p))}</div><ul class="plan-feature-list">${p.destaques.map(x=>`<li>✓ ${esc(x)}</li>`).join('')}</ul>${p.id==='premium'?'<div class="ai-coming-badge">IA incluída • limite padrão 500/mês</div>':''}<button class="btn ${p.id==='pro'?'btn-primary':p.id==='premium'?'btn-dark':'btn-secondary'}" data-plan="${p.id}" ${current?'disabled':''}>${esc(ctaText(p))}</button></article>`
    }).join('');
    const enterprise=`<article class="plan plan-enterprise"><span class="plan-badge">ESCALA</span><h2>Enterprise</h2><h3>Sob consulta</h3><p class="muted">Para operações com 11 ou mais profissionais.</p><div class="plan-limit">11+ profissionais</div><ul class="plan-feature-list"><li>✓ Recursos Premium</li><li>✓ Condições comerciais personalizadas</li><li>✓ Implantação e dimensionamento conforme operação</li></ul><a class="btn btn-secondary" href="/pages/suporte.html">Falar com o BarberFlow</a></article>`;
    els.planGrid.innerHTML=cards+enterprise;
    els.planGrid.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>choosePlan(b.dataset.plan));
  }
  async function loadCatalog(){const d=await api('/assinatura/catalogo');catalogo=d.planos||[];renderCatalog()}
  async function loadCheckoutConfig(){checkoutConfig=await api('/assinatura/checkout/config');return checkoutConfig}
  async function load(){
    try{
      const a=await api('/assinatura');assinatura=a;
      if(!a){els.atual.textContent='Sem assinatura';renderCatalog();return}
      store(a);els.planoEfetivo.textContent=planLabel(a.plano_efetivo||a.plano);els.statusPlano.textContent=String(a.status||'-').toUpperCase();els.proxima.textContent=a.proxima_cobranca?dateBR(a.proxima_cobranca):'-';
      const ciclo=cycleLabel(currentCycle()),mode=a.provedor==='mercadopago_pix'?` • Pix ${ciclo.toLowerCase()} pré-pago`:a.provedor==='mercadopago'?` • cartão ${ciclo.toLowerCase()} recorrente`:'';
      els.atual.textContent=`Contratado: ${planLabel(a.plano)} (${ciclo}) • efetivo agora: ${planLabel(a.plano_efetivo)}${a.limite_profissionais?` • limite: ${a.limite_profissionais} profissionais`:' • profissionais ilimitados'}${mode}${a.provedor_status?` • Mercado Pago: ${a.provedor_status}`:''}`;
      els.trial.innerHTML=a.trial_ativo?`<div class="trial-banner"><strong>Trial Premium ativo</strong><h2 style="margin:6px 0">${a.dias_trial} dia(s) restantes</h2><p>Você está testando todos os recursos Premium gratuitamente até ${dateBR(a.fim_trial)}.</p><div class="trial-progress"><div style="width:${Math.max(5,Math.min(100,(7-Number(a.dias_trial||0))/7*100))}%"></div></div></div>`:'';
      els.acoes.innerHTML='';
      if(a.checkout_url&&a.provedor_status==='pending')els.acoes.innerHTML+=`<a class="btn btn-primary" href="${esc(a.checkout_url)}">Continuar pagamento no Mercado Pago</a>`;
      if(a.status!=='cancelada'&&(a.referencia_externa||a.provedor==='mercadopago_pix'))els.acoes.innerHTML+=`<button class="btn btn-danger" id="cancelarAssinatura">Cancelar assinatura</button>`;
      $('cancelarAssinatura')?.addEventListener('click',cancelar);renderCatalog();
    }catch(e){flash(els.msg,e.message,'error')}
  }
  async function choosePlan(id){
    const p=planById(id);if(!p)return;selectedPlan=p;
    if(activeRecurring()){
      try{
        flash(els.msg,`Atualizando para ${p.nome} • ${cycleLabel()}...`);
        const r=await api('/assinatura/migrar',{method:'POST',body:JSON.stringify({plano:p.id,ciclo:billingCycle})});
        if(r.requires_checkout)return openCheckout(p);
        flash(els.msg,r.mensagem||'Plano atualizado');await load();return;
      }catch(e){flash(els.msg,e.message,'error');return}
    }
    openCheckout(p);
  }
  function resetPaymentChoice(){
    els.cardBtn.classList.remove('active');els.pixBtn.classList.remove('active');
    els.cardPanel.classList.add('hidden');els.pixPanel.classList.add('hidden');
    els.choiceHint?.classList.remove('hidden');
    cardRedirecting=false;els.cardBtn.disabled=false;if(els.cardCheckout)els.cardCheckout.disabled=false;
  }
  async function openCheckout(p){
    selectedPlan=p;clearInterval(pixPollTimer);const annual=billingCycle==='anual';
    els.paymentTitle.textContent=`Assinar ${p.nome} • ${cycleLabel()}`;
    els.summary.textContent=annual?`${money(p.preco_anual)}/ano • equivale a ${money(p.equivalente_mensal_anual)}/mês • ${limiteTexto(p)}`:`${money(p.preco_mensal)}/mês • ${limiteTexto(p)}`;
    if(els.pixExplainer)els.pixExplainer.innerHTML=annual?'<strong>Pix anual</strong><span>Pagamento único do valor anual. Após a aprovação, o plano fica válido por 12 meses.</span>':'<strong>Pix mensal</strong><span>Após o pagamento, o plano fica válido por 1 mês. Para renovar, gere um novo Pix.</span>';
    els.payMsg.classList.add('hidden');els.pixResult.classList.add('hidden');els.pixDocumento.value='';resetPaymentChoice();
    els.modal.classList.remove('hidden');document.body.classList.add('modal-open');
    try{await loadCheckoutConfig();if(checkoutConfig?.recebedor==='supermaster'&&checkoutConfig?.conta_recebedora)els.summary.textContent+=` • Recebimento: ${checkoutConfig.conta_recebedora}`}catch(e){console.warn(e.message)}
  }
  async function closeCheckout(){clearInterval(pixPollTimer);pixPollTimer=null;els.modal.classList.add('hidden');document.body.classList.remove('modal-open');resetPaymentChoice()}
  function selectMethod(method){
    if(method==='card'){
      els.cardBtn.classList.add('active');els.pixBtn.classList.remove('active');els.cardPanel.classList.remove('hidden');els.pixPanel.classList.add('hidden');els.choiceHint?.classList.add('hidden');
      startCardCheckout();return;
    }
    if(checkoutConfig?.diagnostico?.checked&&checkoutConfig?.diagnostico?.pix_available===false){flash(els.payMsg,'Pix não está habilitado na conta Mercado Pago da plataforma. O Supermaster precisa cadastrar/ativar uma chave Pix nessa conta.','error');return}
    els.pixBtn.classList.add('active');els.cardBtn.classList.remove('active');els.pixPanel.classList.remove('hidden');els.cardPanel.classList.add('hidden');els.choiceHint?.classList.add('hidden');
  }
  async function startCardCheckout(){
    if(cardRedirecting||!selectedPlan)return;cardRedirecting=true;els.cardBtn.disabled=true;if(els.cardCheckout)els.cardCheckout.disabled=true;
    flash(els.payMsg,'Preparando o checkout seguro do Mercado Pago...');
    try{
      let r;
      try{r=await api('/assinatura/checkout',{method:'POST',body:JSON.stringify({plano:selectedPlan.id,ciclo:billingCycle})})}
      catch(firstError){
        // O Mercado Pago pode ter criado a assinatura e a resposta HTTP ter se perdido.
        // Uma segunda chamada é segura: o backend procura a referência já criada antes de criar outra.
        await new Promise(resolve=>setTimeout(resolve,900));
        try{r=await api('/assinatura/checkout',{method:'POST',body:JSON.stringify({plano:selectedPlan.id,ciclo:billingCycle})})}catch{throw firstError}
      }
      if(!r.checkout_url)throw new Error('O Mercado Pago não retornou o link de pagamento.');
      sessionStorage.setItem('bf_mp_checkout_pending','1');
      window.location.assign(r.checkout_url);
    }catch(e){cardRedirecting=false;els.cardBtn.disabled=false;if(els.cardCheckout)els.cardCheckout.disabled=false;flash(els.payMsg,e.message,'error')}
  }
  async function generatePix(){
    try{
      if(checkoutConfig?.diagnostico?.checked&&checkoutConfig?.diagnostico?.pix_available===false)throw new Error('Pix não está habilitado na conta Mercado Pago da plataforma. Cadastre/ative uma chave Pix nessa conta.');
      const doc=els.pixDocumento.value.replace(/\D/g,'');if(!/^\d{11,14}$/.test(doc))throw new Error('Informe CPF ou CNPJ válido');
      els.generatePix.disabled=true;els.generatePix.textContent='Gerando Pix...';
      const r=await api('/assinatura/checkout/pix',{method:'POST',body:JSON.stringify({plano:selectedPlan.id,ciclo:billingCycle,documento:doc})});
      els.pixResult.classList.remove('hidden');els.pixCode.value=r.qr_code||'';
      if(r.qr_code_base64){els.pixQr.src=`data:image/png;base64,${r.qr_code_base64}`;els.pixQr.classList.remove('hidden')}else els.pixQr.classList.add('hidden');
      if(r.ticket_url){els.pixTicket.href=r.ticket_url;els.pixTicket.classList.remove('hidden')}else els.pixTicket.classList.add('hidden');
      els.pixResult.scrollIntoView({behavior:'smooth',block:'nearest'});startPixPolling(r.pagamento_id);
    }catch(e){flash(els.payMsg,e.message,'error')}finally{els.generatePix.disabled=false;els.generatePix.textContent='Gerar QR Code Pix'}
  }
  function startPixPolling(id){
    clearInterval(pixPollTimer);let tries=0;
    const check=async()=>{if(++tries>45){clearInterval(pixPollTimer);els.pixStatus.innerHTML='Pagamento ainda pendente. Você pode usar “Sincronizar Mercado Pago” depois.';return}try{const r=await api(`/assinatura/pagamentos/${id}`),st=r.pagamento?.status;if(st==='pago'){clearInterval(pixPollTimer);els.pixStatus.innerHTML='<strong>Pix aprovado! Plano ativado.</strong>';store(r.assinatura||{});setTimeout(async()=>{await closeCheckout();await load()},1000)}else if(st==='cancelado'||st==='falhou'){clearInterval(pixPollTimer);els.pixStatus.innerHTML='<strong>Pagamento não concluído.</strong>'}}catch(e){console.warn(e.message)}};
    check();pixPollTimer=setInterval(check,4000);
  }
  async function cancelar(){if(!confirm('Cancelar a assinatura?'))return;try{await api('/assinatura/cancelar',{method:'POST'});flash(els.msg,'Assinatura cancelada');load()}catch(e){flash(els.msg,e.message,'error')}}

  els.monthly?.addEventListener('click',()=>{billingCycle='mensal';renderCatalog()});
  els.annual?.addEventListener('click',()=>{billingCycle='anual';renderCatalog()});
  els.sync.onclick=async()=>{try{await api('/assinatura/sincronizar',{method:'POST'});flash(els.msg,'Assinatura sincronizada');load()}catch(e){flash(els.msg,e.message,'error')}};
  els.close.onclick=closeCheckout;els.modal.addEventListener('click',e=>{if(e.target===els.modal)closeCheckout()});
  els.cardBtn.onclick=()=>selectMethod('card');els.pixBtn.onclick=()=>selectMethod('pix');els.cardCheckout?.addEventListener('click',startCardCheckout);els.generatePix.onclick=generatePix;
  els.copyPix.onclick=async()=>{try{await navigator.clipboard.writeText(els.pixCode.value);els.copyPix.textContent='Copiado!';setTimeout(()=>els.copyPix.textContent='Copiar código Pix',1200)}catch{els.pixCode.select();document.execCommand('copy')}};
  Promise.all([loadCatalog(),loadCheckoutConfig().catch(()=>null),load()]).catch(e=>flash(els.msg,e.message,'error'));
}
