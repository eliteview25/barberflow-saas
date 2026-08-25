if(requireAuth(['dono','gerente'])){
  document.getElementById('shell').innerHTML=renderShell('config');
  const ids=['nome','telefone','email','endereco','cidade','estado','logo_url','banner_url','cor_primaria','cor_secundaria','cor_botao','cor_fundo','tema','descricao_publica','texto_boas_vindas','instagram','whatsapp_publico','mostrar_precos','mostrar_duracao','politica_cancelamento','pagamento_agendamento','percentual_sinal'];
  const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  function toggleSinal(){campoSinal.style.display=el.pagamento_agendamento.value==='sinal'?'flex':'none'}
  function preview(){
    const dark=el.tema.value==='escuro'; publicPreview.style.background=el.cor_fundo.value||'#f7f7f8'; publicPreview.style.color=dark?'#f9fafb':'#18202b';
    prevBanner.style.backgroundImage=el.banner_url.value?`url("${el.banner_url.value.replace(/"/g,'')}")`:''; prevBanner.classList.toggle('empty',!el.banner_url.value);
    if(el.logo_url.value){prevLogo.innerHTML=`<img src="${el.logo_url.value.replace(/"/g,'')}" alt="Logo">`}else prevLogo.textContent='✂';
    prevNome.textContent=el.nome.value||'Barbearia'; prevWelcome.textContent=el.texto_boas_vindas.value||'Seu estilo começa aqui'; prevDesc.textContent=el.descricao_publica.value||'Descrição da barbearia';
    prevMeta.textContent=[el.mostrar_duracao.checked?'30 min':'',el.mostrar_precos.checked?'R$ 35,00':''].filter(Boolean).join(' • '); prevMeta.style.display=(el.mostrar_duracao.checked||el.mostrar_precos.checked)?'':'none';
    prevButton.style.background=el.cor_botao.value||el.cor_primaria.value||'#f59e0b'; prevButton.style.color='#111'; publicPreview.style.setProperty('--preview-primary',el.cor_primaria.value||'#f59e0b');
  }
  el.pagamento_agendamento.onchange=toggleSinal; ids.forEach(id=>{if(el[id])el[id].addEventListener(el[id].type==='checkbox'?'change':'input',preview)});el.tema.addEventListener('change',preview);
  async function load(){try{const c=await api('/configuracoes');const b=c.barbearia;for(const id of ids){if(!el[id])continue;if(el[id].type==='checkbox')el[id].checked=b[id]!==false;else if(b[id]!==null&&b[id]!==undefined)el[id].value=b[id]}el.cor_primaria.value=b.cor_primaria||'#f59e0b';el.cor_secundaria.value=b.cor_secundaria||'#111827';el.cor_botao.value=b.cor_botao||'#f59e0b';el.cor_fundo.value=b.cor_fundo||'#f7f7f8';el.tema.value=b.tema||'claro';el.pagamento_agendamento.value=b.pagamento_agendamento||'nenhum';el.percentual_sinal.value=Number(b.percentual_sinal||50);toggleSinal();preview();linkPublico.href=`/agendar/${b.slug}`}catch(e){flash(msg,e.message,'error')}}
  salvar.onclick=async()=>{try{const body={};for(const id of ids){body[id]=el[id].type==='checkbox'?el[id].checked:el[id].value}body.estado=body.estado.toUpperCase();body.percentual_sinal=Number(body.percentual_sinal||50);await api('/configuracoes',{method:'PUT',body:JSON.stringify(body)});flash(msg,'Configurações e página pública salvas')}catch(e){flash(msg,e.message,'error')}};
  load();
}
