if(requireAuth(['dono','gerente'])){
  document.getElementById('shell').innerHTML=renderShell('equipe');
  const owner=hasRole('dono'); let dados=[]; let profissionais=[];
  if(!owner) novoUser.classList.add('hidden');
  async function load(){try{dados=await api('/usuarios');usuarios.innerHTML=dados.map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.email)}</td><td><span class="badge">${esc(roleLabel(x.papel))}</span></td><td>${esc(x.barbeiro_nome||'-')}</td><td><span class="badge">${x.ativo?'Ativo':'Inativo'}</span></td><td class="actions">${owner?`<button class="btn btn-secondary" onclick="editUser(${x.id})">Editar</button><button class="btn ${x.ativo?'btn-danger':'btn-success'}" onclick="toggleUser(${x.id},${!x.ativo})">${x.ativo?'Desativar':'Ativar'}</button>`:'Somente leitura'}</td></tr>`).join('')||'<tr><td colspan="6">Nenhum usuário.</td></tr>';}catch(e){flash(msg,e.message,'error')}}
  async function loadBarbers(){try{profissionais=await api('/barbeiros');uBarbeiro.innerHTML='<option value="">Selecione</option>'+profissionais.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}catch{}}
  function roleChanged(){barbeiroField.classList.toggle('hidden',uPapel.value!=='barbeiro')}
  function openNew(){uId.value='';uNome.value='';uEmail.value='';uSenha.value='';uPapel.value='recepcao';uBarbeiro.value='';modalTitle.textContent='Novo acesso';emailField.classList.remove('hidden');senhaField.classList.remove('hidden');roleChanged();modalUser.classList.remove('hidden')}
  window.editUser=id=>{const x=dados.find(v=>v.id===id);if(!x)return;uId.value=x.id;uNome.value=x.nome;uPapel.value=x.papel;uBarbeiro.value=x.barbeiro_id||'';modalTitle.textContent='Editar acesso';emailField.classList.add('hidden');senhaField.classList.add('hidden');roleChanged();modalUser.classList.remove('hidden')};
  window.toggleUser=async(id,ativo)=>{try{await api(`/usuarios/${id}/status`,{method:'PATCH',body:JSON.stringify({ativo})});load()}catch(e){flash(msg,e.message,'error')}};
  novoUser.onclick=openNew;fecharUser.onclick=()=>modalUser.classList.add('hidden');uPapel.onchange=roleChanged;
  salvarUser.onclick=async()=>{try{if(uId.value){await api(`/usuarios/${uId.value}`,{method:'PUT',body:JSON.stringify({nome:uNome.value,papel:uPapel.value,barbeiro_id:uPapel.value==='barbeiro'?Number(uBarbeiro.value):null})})}else{await api('/usuarios',{method:'POST',body:JSON.stringify({nome:uNome.value,email:uEmail.value,senha:uSenha.value,papel:uPapel.value,barbeiro_id:uPapel.value==='barbeiro'?Number(uBarbeiro.value):null})})}modalUser.classList.add('hidden');flash(msg,'Acesso salvo');load()}catch(e){flash(msg,e.message,'error')}};
  loadBarbers().then(load);
}
