if(requireAuth(['dono','gerente'])){
  document.getElementById('shell').innerHTML=renderShell('config');
  function toggleSinal(){campoSinal.style.display=pagamento_agendamento.value==='sinal'?'flex':'none'}
  pagamento_agendamento.onchange=toggleSinal;
  async function load(){try{const c=await api('/configuracoes');const b=c.barbearia;nome.value=b.nome||'';telefone.value=b.telefone||'';email.value=b.email||'';endereco.value=b.endereco||'';cidade.value=b.cidade||'';estado.value=b.estado||'';logo_url.value=b.logo_url||'';cor_primaria.value=b.cor_primaria||'#f59e0b';pagamento_agendamento.value=b.pagamento_agendamento||'nenhum';percentual_sinal.value=Number(b.percentual_sinal||50);toggleSinal();linkPublico.href=`/agendar/${b.slug}`}catch(e){flash(msg,e.message,'error')}}
  salvar.onclick=async()=>{try{await api('/configuracoes',{method:'PUT',body:JSON.stringify({nome:nome.value,telefone:telefone.value,email:email.value,endereco:endereco.value,cidade:cidade.value,estado:estado.value.toUpperCase(),logo_url:logo_url.value,cor_primaria:cor_primaria.value,pagamento_agendamento:pagamento_agendamento.value,percentual_sinal:Number(percentual_sinal.value||50)})});flash(msg,'Configurações salvas')}catch(e){flash(msg,e.message,'error')}};
  load();
}
