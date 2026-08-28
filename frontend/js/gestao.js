const tabsEl = document.getElementById('tabs');
const contentEl = document.getElementById('content');
const msgEl = document.getElementById('msg');

const GESTAO_TABS = [
  ['pdv','🧾 Caixa/PDV'],
  ['estoque','📦 Produtos e Estoque'],
  ['comissoes','💈 Comissões'],
  ['fila','⏱️ Fila'],
  ['crm','👤 CRM'],
  ['fidelidade','🎁 Fidelidade'],
  ['avaliacoes','⭐ Avaliações'],
  ['relatorios','📊 Relatórios'],
  ['dados','⬇️ Dados']
];

function byId(id){ return document.getElementById(id); }
function loading(titulo='Carregando...'){
  contentEl.innerHTML=`<div class="loading-state"><strong>${esc(titulo)}</strong><p class="muted">Aguarde um instante.</p></div>`;
}
function showError(error){
  console.error('Gestão:', error);
  contentEl.innerHTML=`<div class="notice error"><strong>Não foi possível carregar esta área.</strong><br>${esc(error?.message || 'Erro inesperado')}</div>`;
}
function denied(){
  contentEl.innerHTML='<div class="upgrade-card"><strong>🔒 Recurso Premium</strong><p>Esta ferramenta faz parte da gestão avançada do Premium.</p><a class="btn btn-primary" href="/pages/assinatura.html">Ver Premium</a></div>';
}

if(requireAuth(['dono','gerente','recepcao'])){
  byId('shell').innerHTML=renderShell('gestao');
  tabsEl.innerHTML=GESTAO_TABS.map(([id,label])=>`<button type="button" class="tab-btn" data-tab="${id}">${label}</button>`).join('');
  tabsEl.addEventListener('click',e=>{
    const button=e.target.closest('[data-tab]');
    if(button) openTab(button.dataset.tab);
  });
  openTab('pdv');
}

async function base(){
  const [cs,bs,ss]=await Promise.all([api('/clientes'),api('/barbeiros'),api('/servicos')]);
  return {cs,bs,ss};
}

async function openTab(tab){
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  loading();
  try{
    if(tab==='pdv'||tab==='estoque'){
      if(!hasFeature('pdv_estoque')) return denied();
      return tab==='pdv'?pdv():estoque();
    }
    if(tab==='comissoes'){ if(!hasFeature('comissoes'))return denied(); return comissoes(); }
    if(tab==='fila'){ if(!hasFeature('fila_espera'))return denied(); return fila(); }
    if(tab==='crm'){ if(!hasFeature('crm_avancado'))return denied(); return crm(); }
    if(tab==='fidelidade'){ if(!hasFeature('fidelidade'))return denied(); return fidelidade(); }
    if(tab==='avaliacoes'){ if(!hasFeature('avaliacoes'))return denied(); return avaliacoes(); }
    if(tab==='relatorios'){ if(!hasFeature('relatorios_avancados'))return denied(); return relatorios(); }
    if(tab==='dados'){ if(!hasFeature('exportacao_dados'))return denied(); return dados(); }
    contentEl.innerHTML='<p class="muted">Área não encontrada.</p>';
  }catch(error){ showError(error); }
}

const estoqueState={produtos:[],busca:'',status:'todos',nivel:'todos'};
function productNumbers(p){return{preco:Number(p.preco||0),custo:Number(p.custo||0),estoque:Number(p.estoque||0),minimo:Number(p.estoque_minimo||0)}}
function productStockBadge(p){const n=productNumbers(p);if(n.estoque<=0)return '<span class="badge product-stock-out">Sem estoque</span>';if(n.estoque<=n.minimo)return '<span class="badge product-stock-low">Estoque baixo</span>';return '<span class="badge product-stock-ok">Estoque OK</span>'}
function productMargin(p){const n=productNumbers(p);if(n.preco<=0)return 0;return Math.max(0,((n.preco-n.custo)/n.preco)*100)}
function filteredProducts(){
  const q=estoqueState.busca.trim().toLowerCase();
  return estoqueState.produtos.filter(p=>{
    const n=productNumbers(p);
    const text=`${p.nome||''} ${p.sku||''}`.toLowerCase();
    if(q&&!text.includes(q))return false;
    if(estoqueState.status==='ativos'&&!p.ativo)return false;
    if(estoqueState.status==='inativos'&&p.ativo)return false;
    if(estoqueState.nivel==='baixo'&&!(p.ativo&&n.estoque<=n.minimo))return false;
    if(estoqueState.nivel==='zerado'&&n.estoque>0)return false;
    return true;
  });
}
function renderEstoque(){
  const produtos=filteredProducts();
  const ativos=estoqueState.produtos.filter(p=>p.ativo);
  const baixos=ativos.filter(p=>{const n=productNumbers(p);return n.estoque<=n.minimo});
  const unidades=ativos.reduce((t,p)=>t+productNumbers(p).estoque,0);
  const valor=ativos.reduce((t,p)=>{const n=productNumbers(p);return t+n.custo*n.estoque},0);
  const canManage=hasRole('dono','gerente');
  contentEl.innerHTML=`
    <div class="section-head product-head"><div><h2>Produtos e estoque</h2><p>Controle catálogo, preços, margem e quantidade disponível para venda.</p></div>${canManage?'<button class="btn btn-primary" id="novoProduto">+ Novo produto</button>':''}</div>
    ${!canManage?'<div class="notice">Você pode consultar o estoque. Alterações são permitidas para Dono e Gerente.</div>':''}
    <div class="cards compact-cards product-kpis">
      <div class="card"><div class="label">Produtos ativos</div><div class="value">${ativos.length}</div><small>${estoqueState.produtos.length} cadastrados</small></div>
      <div class="card"><div class="label">Estoque baixo</div><div class="value">${baixos.length}</div><small>inclui itens zerados</small></div>
      <div class="card"><div class="label">Unidades em estoque</div><div class="value">${unidades.toLocaleString('pt-BR')}</div><small>somente produtos ativos</small></div>
      <div class="card"><div class="label">Valor em estoque</div><div class="value">${money(valor)}</div><small>calculado pelo custo</small></div>
    </div>
    <div class="product-toolbar">
      <div class="product-search"><span>⌕</span><input id="produtoBusca" type="search" placeholder="Buscar por produto ou SKU" value="${esc(estoqueState.busca)}"></div>
      <select id="produtoStatus" aria-label="Filtrar por status"><option value="todos" ${estoqueState.status==='todos'?'selected':''}>Todos os status</option><option value="ativos" ${estoqueState.status==='ativos'?'selected':''}>Ativos</option><option value="inativos" ${estoqueState.status==='inativos'?'selected':''}>Inativos</option></select>
      <select id="produtoNivel" aria-label="Filtrar por estoque"><option value="todos" ${estoqueState.nivel==='todos'?'selected':''}>Todo o estoque</option><option value="baixo" ${estoqueState.nivel==='baixo'?'selected':''}>Estoque baixo</option><option value="zerado" ${estoqueState.nivel==='zerado'?'selected':''}>Sem estoque</option></select>
    </div>
    <div class="table-wrap product-table-wrap"><table class="table product-table"><thead><tr><th>Produto</th><th>Venda</th><th>Custo / margem</th><th>Estoque</th><th>Status</th>${canManage?'<th>Ações</th>':''}</tr></thead><tbody>
      ${produtos.map(p=>{const n=productNumbers(p);return `<tr class="${p.ativo?'':'product-inactive-row'}"><td><div class="product-name product-name-photo"><div class="product-thumb">${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="" loading="lazy">`:'📦'}</div><div><strong>${esc(p.nome)}</strong><small>SKU: ${esc(p.sku||'sem SKU')}</small></div></div></td><td><strong>${money(n.preco)}</strong></td><td>${money(n.custo)}<small class="product-margin">Margem ${productMargin(p).toFixed(0)}%</small></td><td><div class="product-stock"><strong>${n.estoque.toLocaleString('pt-BR')}</strong><small>Mín. ${n.minimo.toLocaleString('pt-BR')}</small>${productStockBadge(p)}</div></td><td><span class="badge ${p.ativo?'product-active':'product-inactive'}">${p.ativo?'Ativo':'Inativo'}</span></td>${canManage?`<td><div class="product-actions"><button type="button" class="btn btn-secondary" data-prod-edit="${p.id}">Editar</button><button type="button" class="btn btn-secondary" data-prod-stock="${p.id}">Estoque</button><button type="button" class="btn ${p.ativo?'btn-danger':'btn-success'}" data-prod-toggle="${p.id}">${p.ativo?'Desativar':'Ativar'}</button><button type="button" class="btn btn-danger btn-outline-danger" data-prod-delete="${p.id}">Excluir</button></div></td>`:''}</tr>`}).join('')||`<tr><td colspan="${canManage?6:5}"><div class="product-empty"><strong>Nenhum produto encontrado</strong><span>${estoqueState.produtos.length?'Ajuste os filtros para ver outros itens.':'Cadastre o primeiro produto para começar a controlar o estoque.'}</span></div></td></tr>`}
    </tbody></table></div>`;

  byId('produtoBusca').addEventListener('input',e=>{estoqueState.busca=e.target.value;renderEstoque();byId('produtoBusca')?.focus()});
  byId('produtoStatus').addEventListener('change',e=>{estoqueState.status=e.target.value;renderEstoque()});
  byId('produtoNivel').addEventListener('change',e=>{estoqueState.nivel=e.target.value;renderEstoque()});
  if(canManage){
    byId('novoProduto')?.addEventListener('click',()=>openProductModal());
    contentEl.querySelectorAll('[data-prod-edit]').forEach(b=>b.addEventListener('click',()=>openProductModal(findProduct(b.dataset.prodEdit))));
    contentEl.querySelectorAll('[data-prod-stock]').forEach(b=>b.addEventListener('click',()=>openStockModal(findProduct(b.dataset.prodStock))));
    contentEl.querySelectorAll('[data-prod-toggle]').forEach(b=>b.addEventListener('click',()=>toggleProduct(findProduct(b.dataset.prodToggle))));
    contentEl.querySelectorAll('[data-prod-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(findProduct(b.dataset.prodDelete))));
  }
  initResponsiveTables();
}
function findProduct(id){return estoqueState.produtos.find(p=>String(p.id)===String(id))}
async function estoque(){
  estoqueState.produtos=await api('/operacao/produtos');
  renderEstoque();
}
function closeProductModal(){document.getElementById('productModal')?.remove()}
function productPayload(p,override={}){const n=productNumbers(p||{});return{nome:p?.nome||'',sku:p?.sku||'',preco:n.preco,custo:n.custo,estoque:n.estoque,estoque_minimo:n.minimo,imagem_url:p?.imagem_url||'',ativo:p?.ativo!==false,...override}}
function openProductModal(produto=null){
  closeProductModal();
  const editing=Boolean(produto);
  const p=productPayload(produto||{});
  const modal=document.createElement('div');modal.id='productModal';modal.className='modal';
  modal.innerHTML=`<div class="modal-box product-modal-box"><div class="modal-head"><div><h2>${editing?'Editar produto':'Novo produto'}</h2><p class="muted">${editing?'Atualize os dados do item e salve.':'Cadastre um item para venda no caixa.'}</p></div><button type="button" class="close" id="fecharProduto" aria-label="Fechar">×</button></div>
    <form id="produtoForm">
      <div class="product-photo-editor">
        <div id="produtoFotoPreview" class="product-photo-preview">${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="Foto do produto">`:'<span>📦</span><small>Sem foto</small>'}</div>
        <div class="product-photo-controls"><div class="field"><label>Foto do produto <small>(opcional)</small></label><input id="produtoImagemUrl" value="${esc(p.imagem_url||'')}" placeholder="https://... ou envie uma foto"></div><input id="produtoImagemFile" type="file" accept="image/jpeg,image/png" class="hidden"><div class="actions"><button id="enviarFotoProduto" type="button" class="btn btn-secondary">Enviar foto</button><button id="removerFotoProduto" type="button" class="btn btn-secondary ${p.imagem_url?'':'hidden'}">Remover foto</button></div><small class="muted">JPG ou PNG, até 5 MB. A foto é opcional.</small></div>
      </div>
      <div class="form-grid">
        <div class="field product-field-wide"><label>Nome do produto</label><input id="produtoNome" maxlength="160" required value="${esc(p.nome)}" placeholder="Ex.: Pomada modeladora"></div>
        <div class="field"><label>SKU</label><input id="produtoSku" maxlength="80" value="${esc(p.sku)}" placeholder="Ex.: POM-001"></div>
        <div class="field"><label>Preço de venda</label><input id="produtoPreco" type="number" min="0" step="0.01" required value="${p.preco}"></div>
        <div class="field"><label>Custo</label><input id="produtoCusto" type="number" min="0" step="0.01" required value="${p.custo}"></div>
        <div class="field"><label>Estoque atual</label><input id="produtoEstoque" type="number" min="0" step="1" required value="${p.estoque}"></div>
        <div class="field"><label>Estoque mínimo</label><input id="produtoMinimo" type="number" min="0" step="1" required value="${p.estoque_minimo}"></div>
      </div>
      <div class="product-form-footer"><label class="check-row"><input id="produtoAtivo" type="checkbox" ${p.ativo?'checked':''}> Produto ativo para venda</label><div id="produtoResumo" class="product-profit-preview"></div></div>
      <div id="produtoModalMsg" class="notice error hidden"></div>
      <div class="actions product-modal-actions"><button type="button" class="btn btn-secondary" id="cancelarProduto">Cancelar</button><button type="submit" class="btn btn-primary" id="salvarProduto">${editing?'Salvar alterações':'Cadastrar produto'}</button></div>
    </form></div>`;
  document.body.appendChild(modal);
  const photoPreview=byId('produtoFotoPreview'),photoUrl=byId('produtoImagemUrl'),photoFile=byId('produtoImagemFile'),uploadPhotoBtn=byId('enviarFotoProduto'),removePhotoBtn=byId('removerFotoProduto');
  const renderPhoto=()=>{const url=photoUrl.value.trim();photoPreview.innerHTML=url?`<img src="${esc(url)}" alt="Foto do produto">`:'<span>📦</span><small>Sem foto</small>';removePhotoBtn.classList.toggle('hidden',!url)};
  photoUrl.addEventListener('input',renderPhoto);
  uploadPhotoBtn.addEventListener('click',()=>photoFile.click());
  photoFile.addEventListener('change',async()=>{const file=photoFile.files?.[0];if(!file)return;const err=byId('produtoModalMsg');try{if(!['image/png','image/jpeg'].includes(file.type))throw new Error('Use uma foto JPG ou PNG.');if(file.size>5*1024*1024)throw new Error('A foto deve ter no máximo 5 MB.');uploadPhotoBtn.disabled=true;uploadPhotoBtn.textContent='Enviando...';const r=await fetch('/api/uploads/produto-imagem',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-CSRF-Token':csrfToken()},body:file});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.erro||'Não foi possível enviar a foto');photoUrl.value=d.url;renderPhoto()}catch(error){err.textContent=error.message;err.classList.remove('hidden')}finally{uploadPhotoBtn.disabled=false;uploadPhotoBtn.textContent='Enviar foto';photoFile.value=''}});
  removePhotoBtn.addEventListener('click',()=>{photoUrl.value='';renderPhoto()});
  const refreshPreview=()=>{const preco=Number(byId('produtoPreco').value||0),custo=Number(byId('produtoCusto').value||0),lucro=preco-custo,margem=preco>0?(lucro/preco)*100:0;byId('produtoResumo').innerHTML=`<span>Lucro unitário <strong>${money(lucro)}</strong></span><span>Margem <strong>${Math.max(0,margem).toFixed(1)}%</strong></span>`};
  ['produtoPreco','produtoCusto'].forEach(id=>byId(id).addEventListener('input',refreshPreview));refreshPreview();
  byId('fecharProduto').addEventListener('click',closeProductModal);byId('cancelarProduto').addEventListener('click',closeProductModal);modal.addEventListener('click',e=>{if(e.target===modal)closeProductModal()});
  byId('produtoForm').addEventListener('submit',async e=>{e.preventDefault();const btn=byId('salvarProduto'),err=byId('produtoModalMsg');btn.disabled=true;err.classList.add('hidden');try{
    const body={nome:byId('produtoNome').value.trim(),sku:byId('produtoSku').value.trim(),preco:byId('produtoPreco').value,custo:byId('produtoCusto').value,estoque:byId('produtoEstoque').value,estoque_minimo:byId('produtoMinimo').value,imagem_url:byId('produtoImagemUrl').value.trim(),ativo:byId('produtoAtivo').checked};
    if(!body.nome)throw new Error('Informe o nome do produto.');
    await api(editing?`/operacao/produtos/${produto.id}`:'/operacao/produtos',{method:editing?'PUT':'POST',body:JSON.stringify(body)});closeProductModal();await estoque();flash(msgEl,editing?'Produto atualizado.':'Produto cadastrado.');
  }catch(error){err.textContent=error.message;err.classList.remove('hidden');btn.disabled=false}});
  byId('produtoNome').focus();
}
function openStockModal(produto){if(!produto)return;closeProductModal();const n=productNumbers(produto),modal=document.createElement('div');modal.id='productModal';modal.className='modal';modal.innerHTML=`<div class="modal-box stock-modal-box"><div class="modal-head"><div><h2>Ajustar estoque</h2><p class="muted">${esc(produto.nome)}</p></div><button type="button" class="close" id="fecharProduto">×</button></div><div class="stock-adjust-current"><span>Estoque atual</span><strong id="stockPreview">${n.estoque}</strong></div><div class="stock-quick-actions"><button class="btn btn-secondary" type="button" data-stock-delta="-5">−5</button><button class="btn btn-secondary" type="button" data-stock-delta="-1">−1</button><button class="btn btn-secondary" type="button" data-stock-delta="1">+1</button><button class="btn btn-secondary" type="button" data-stock-delta="5">+5</button></div><div class="field"><label>Nova quantidade</label><input id="stockValue" type="number" min="0" step="1" value="${n.estoque}"></div><div id="produtoModalMsg" class="notice error hidden"></div><div class="actions product-modal-actions"><button class="btn btn-secondary" type="button" id="cancelarProduto">Cancelar</button><button class="btn btn-primary" type="button" id="salvarEstoque">Salvar estoque</button></div></div>`;document.body.appendChild(modal);
  const input=byId('stockValue'),preview=byId('stockPreview'),sync=()=>preview.textContent=Math.max(0,Number(input.value||0)).toLocaleString('pt-BR');input.addEventListener('input',sync);modal.querySelectorAll('[data-stock-delta]').forEach(b=>b.addEventListener('click',()=>{input.value=Math.max(0,Number(input.value||0)+Number(b.dataset.stockDelta));sync()}));byId('fecharProduto').addEventListener('click',closeProductModal);byId('cancelarProduto').addEventListener('click',closeProductModal);modal.addEventListener('click',e=>{if(e.target===modal)closeProductModal()});byId('salvarEstoque').addEventListener('click',async()=>{const err=byId('produtoModalMsg');try{await api(`/operacao/produtos/${produto.id}`,{method:'PUT',body:JSON.stringify(productPayload(produto,{estoque:input.value}))});closeProductModal();await estoque();flash(msgEl,'Estoque atualizado.')}catch(error){err.textContent=error.message;err.classList.remove('hidden')}});input.focus();input.select();
}
async function toggleProduct(produto){if(!produto)return;const action=produto.ativo?'desativar':'ativar';if(!confirm(`Deseja ${action} "${produto.nome}"?`))return;try{await api(`/operacao/produtos/${produto.id}`,{method:'PUT',body:JSON.stringify(productPayload(produto,{ativo:!produto.ativo}))});await estoque();flash(msgEl,`Produto ${produto.ativo?'desativado':'ativado'}.`)}catch(error){flash(msgEl,error.message,'error')}}
async function deleteProduct(produto){if(!produto)return;if(!confirm(`Excluir permanentemente "${produto.nome}"?\n\nAs vendas antigas continuarão preservadas no histórico, mas o produto sairá do catálogo.`))return;try{await api(`/operacao/produtos/${produto.id}`,{method:'DELETE'});await estoque();flash(msgEl,'Produto excluído com sucesso.')}catch(error){flash(msgEl,error.message,'error')}}

async function pdv(){
  const [{cs,bs,ss},produtos]=await Promise.all([base(),api('/operacao/produtos')]);
  contentEl.innerHTML=`
    <div class="section-head"><div><h2>Caixa / PDV</h2><p>Finalize serviços e venda produtos no mesmo caixa.</p></div></div>
    <div class="form-grid">
      <div class="field"><label>Cliente</label><select id="pdvCliente"><option value="">Avulso</option>${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="field"><label>Barbeiro</label><select id="pdvBarbeiro"><option value="">Não informar</option>${bs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="field"><label>Serviço</label><select id="pdvServico"><option value="">Nenhum</option>${ss.map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)}</option>`).join('')}</select></div>
      <div class="field"><label>Produto</label><select id="pdvProduto"><option value="">Nenhum</option>${produtos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)} (${x.estoque})</option>`).join('')}</select></div>
      <div class="field"><label>Pagamento</label><select id="pdvPagamento"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="mercado_pago">Mercado Pago</option></select></div>
      <div class="field"><label>Desconto</label><input id="pdvDesconto" type="number" value="0" min="0" step="0.01"></div>
    </div>
    <button class="btn btn-primary" id="finalizarVenda">Finalizar venda</button>`;

  byId('finalizarVenda').addEventListener('click',async()=>{
    const servicoId=byId('pdvServico').value;
    const produtoId=byId('pdvProduto').value;
    const itens=[];
    if(servicoId)itens.push({tipo:'servico',id:Number(servicoId),quantidade:1});
    if(produtoId)itens.push({tipo:'produto',id:Number(produtoId),quantidade:1});
    if(!itens.length)return alert('Escolha ao menos um serviço ou produto.');
    try{
      const r=await api('/operacao/vendas',{method:'POST',body:JSON.stringify({
        cliente_id:byId('pdvCliente').value||null,
        barbeiro_id:byId('pdvBarbeiro').value||null,
        forma_pagamento:byId('pdvPagamento').value,
        desconto:byId('pdvDesconto').value,
        itens
      })});
      alert(`Venda #${r.id} finalizada: ${money(r.total)}`);
      await pdv();
    }catch(e){alert(e.message);}
  });
}

async function comissoes(){
  const [resumo,barbeiros]=await Promise.all([api('/operacao/comissoes'),api('/barbeiros')]);
  contentEl.innerHTML=`<h2>Comissões</h2><div class="table-wrap"><table class="table"><thead><tr><th>Barbeiro</th><th>Atend.</th><th>Serviços</th><th>Produtos</th><th>Total</th></tr></thead><tbody>${resumo.map(x=>`<tr><td>${esc(x.nome)}</td><td>${x.atendimentos}</td><td>${money(x.comissao_servicos)}</td><td>${money(x.comissao_produtos)}</td><td><strong>${money(Number(x.comissao_servicos)+Number(x.comissao_produtos))}</strong></td></tr>`).join('')||'<tr><td colspan="5">Sem dados no período.</td></tr>'}</tbody></table></div><h3>Percentuais por barbeiro</h3>${barbeiros.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><input id="cs${x.id}" type="number" placeholder="% serviços" value="${x.comissao_servico_pct||0}"><input id="cp${x.id}" type="number" placeholder="% produtos" value="${x.comissao_produto_pct||0}"><button class="btn btn-secondary" data-save-com="${x.id}">Salvar</button></div>`).join('')}`;
  contentEl.querySelectorAll('[data-save-com]').forEach(btn=>btn.addEventListener('click',()=>saveCom(btn.dataset.saveCom)));
  initResponsiveTables();
}
async function saveCom(id){
  try{await api('/operacao/comissoes/barbeiros/'+id,{method:'PUT',body:JSON.stringify({comissao_servico_pct:byId('cs'+id).value,comissao_produto_pct:byId('cp'+id).value})});await comissoes();}catch(e){alert(e.message)}
}

async function fila(){
  const [{cs,bs,ss},itens]=await Promise.all([base(),api('/operacao/fila')]);
  contentEl.innerHTML=`<h2>Fila de espera / encaixes</h2><div class="form-grid"><div class="field"><label>Cliente</label><select id="filaCliente">${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Serviço</label><select id="filaServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Barbeiro</label><select id="filaBarbeiro"><option value="">Qualquer</option>${bs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div></div><button class="btn btn-primary" id="adicionarFila">Adicionar à fila</button><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Ação</th></tr></thead><tbody>${itens.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.cliente)}</td><td>${esc(x.servico)}</td><td>${esc(x.barbeiro||'Qualquer')}</td><td><button class="btn btn-secondary" data-done-fila="${x.id}">Atendido</button></td></tr>`).join('')||'<tr><td colspan="5">Fila vazia.</td></tr>'}</tbody></table></div>`;
  byId('adicionarFila').addEventListener('click',async()=>{try{await api('/operacao/fila',{method:'POST',body:JSON.stringify({cliente_id:byId('filaCliente').value,servico_id:byId('filaServico').value,barbeiro_id:byId('filaBarbeiro').value||null})});await fila();}catch(e){alert(e.message)}});
  contentEl.querySelectorAll('[data-done-fila]').forEach(btn=>btn.addEventListener('click',()=>doneFila(btn.dataset.doneFila)));
  initResponsiveTables();
}
async function doneFila(id){try{await api('/operacao/fila/'+id,{method:'PATCH',body:JSON.stringify({status:'atendido'})});await fila();}catch(e){alert(e.message)}}

async function crm(){
  const clientes=await api('/clientes');
  contentEl.innerHTML=`<h2>CRM de clientes</h2><p>Histórico, gasto, faltas e fidelidade.</p><div class="form-grid"><div class="field"><label>Cliente</label><select id="crmCliente"><option value="">Selecione</option>${clientes.map(x=>`<option value="${x.id}">${esc(x.nome)} — ${esc(x.telefone)}</option>`).join('')}</select></div></div><div id="crmResultado"><p class="muted">Selecione um cliente para visualizar o perfil.</p></div>`;
  byId('crmCliente').addEventListener('change',async e=>{
    if(!e.target.value)return;
    try{
      const r=await api('/operacao/crm/'+e.target.value);
      byId('crmResultado').innerHTML=`<div class="cards"><div class="card"><div class="label">Visitas</div><div class="value">${r.metricas.visitas}</div></div><div class="card"><div class="label">Total gasto</div><div class="value">${money(r.metricas.total_gasto)}</div></div><div class="card"><div class="label">Faltas</div><div class="value">${r.metricas.faltas}</div></div><div class="card"><div class="label">Pontos</div><div class="value">${r.fidelidade.pontos||0}</div></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Valor</th></tr></thead><tbody>${r.historico.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${esc(x.servico)}</td><td>${esc(x.barbeiro)}</td><td>${esc(x.status)}</td><td>${money(x.preco)}</td></tr>`).join('')||'<tr><td colspan="5">Sem histórico.</td></tr>'}</tbody></table></div>`;
      initResponsiveTables();
    }catch(err){byId('crmResultado').innerHTML=`<div class="notice error">${esc(err.message)}</div>`}
  });
}

async function fidelidade(){
  const [cfg,pacotes]=await Promise.all([api('/operacao/fidelidade'),api('/operacao/pacotes')]);
  contentEl.innerHTML=`<h2>Fidelidade e pacotes</h2><div class="form-grid"><label class="check"><input id="fidAtivo" type="checkbox" ${cfg.ativo?'checked':''}> Ativar programa de pontos</label><div class="field"><label>Pontos por R$ 1</label><input id="fidPontosReal" type="number" value="${cfg.pontos_por_real||1}"></div><div class="field"><label>Pontos para recompensa</label><input id="fidRecompensaPontos" type="number" value="${cfg.pontos_recompensa||500}"></div><div class="field"><label>Recompensa</label><input id="fidRecompensaTexto" value="${esc(cfg.recompensa_texto||'Benefício da barbearia')}"></div></div><button class="btn btn-primary" id="salvarFidelidade">Salvar fidelidade</button><hr><div class="section-head"><h3>Pacotes / mensalidades</h3><button class="btn btn-secondary" id="novoPacote">+ Pacote</button></div>${pacotes.map(x=>`<div class="card"><strong>${esc(x.nome)}</strong><p>${money(x.preco)} — ${esc(x.descricao||'')}</p></div>`).join('')||'<p class="muted">Nenhum pacote.</p>'}`;
  byId('salvarFidelidade').addEventListener('click',async()=>{try{await api('/operacao/fidelidade',{method:'PUT',body:JSON.stringify({ativo:byId('fidAtivo').checked,pontos_por_real:byId('fidPontosReal').value,pontos_recompensa:byId('fidRecompensaPontos').value,recompensa_texto:byId('fidRecompensaTexto').value})});alert('Fidelidade salva.')}catch(e){alert(e.message)}});
  byId('novoPacote').addEventListener('click',async()=>{const nome=prompt('Nome do pacote');if(!nome)return;const preco=prompt('Preço','0'),descricao=prompt('O que inclui?','');try{await api('/operacao/pacotes',{method:'POST',body:JSON.stringify({nome,preco,descricao})});await fidelidade();}catch(e){alert(e.message)}});
}

async function avaliacoes(){
  const itens=await api('/operacao/avaliacoes');
  contentEl.innerHTML=`<h2>Avaliações</h2>${itens.map(x=>`<div class="card"><strong>${'⭐'.repeat(x.nota)} ${esc(x.cliente)}</strong><p>${esc(x.comentario||'Sem comentário')}</p><small>${esc(x.barbeiro)} · ${esc(x.servico)}</small></div>`).join('')||'<p class="muted">Ainda sem avaliações.</p>'}`;
}

async function relatorios(){
  const r=await api('/operacao/relatorios'); const x=r.resumo;
  contentEl.innerHTML=`<h2>Relatórios avançados</h2><div class="cards"><div class="card"><div class="label">Atendimentos</div><div class="value">${x.atendimentos}</div></div><div class="card"><div class="label">Ticket médio</div><div class="value">${money(x.ticket_medio)}</div></div><div class="card"><div class="label">Cancelamentos</div><div class="value">${x.cancelamentos}</div></div><div class="card"><div class="label">No-show</div><div class="value">${x.no_show}</div></div></div><h3>Serviços mais vendidos</h3>${r.top_servicos.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><span>${x.quantidade} atendimento(s)</span></div>`).join('')||'<p class="muted">Sem dados suficientes.</p>'}`;
}

function dados(){
  contentEl.innerHTML=`<h2>Exportação de dados</h2><p>Os dados da barbearia podem ser exportados em CSV.</p><div class="actions"><button class="btn btn-secondary" data-export="clientes">Exportar clientes</button><button class="btn btn-secondary" data-export="agendamentos">Exportar agendamentos</button><button class="btn btn-secondary" data-export="vendas">Exportar vendas</button></div>`;
  contentEl.querySelectorAll('[data-export]').forEach(btn=>btn.addEventListener('click',()=>downloadCsv(btn.dataset.export)));
}
async function downloadCsv(tipo){
  const r=await fetch('/api/operacao/exportar/'+tipo,{credentials:'same-origin',headers:authHeaders()});
  if(!r.ok)return alert('Falha na exportação');
  const blob=await r.blob(); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=`barberflow-${tipo}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
