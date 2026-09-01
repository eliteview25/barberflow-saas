const tabsEl = document.getElementById('tabs');
const contentEl = document.getElementById('content');
const msgEl = document.getElementById('msg');

const GESTAO_TABS = [
  ['pdv','🧾 Caixa/PDV'],
  ['vendas','📋 Histórico'],
  ['comandas','📋 Comandas'],
  ['estoque','📦 Produtos & Estoque'],
  ['comissoes','💈 Comissões'],
  ['fila','⏱️ Fila'],
  ['crm','👤 CRM'],
  ['fidelidade','🎁 Fidelidade & Pacotes'],
  ['clube','♻️ Clube'],
  ['fiscal','🧾 Fiscal'],
  ['bi','📊 BI'],
  ['oportunidades','✨ Oportunidades'],
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
  contentEl.innerHTML='<div class="upgrade-card"><strong>🔒 Recurso não incluído</strong><p>Esta ferramenta não faz parte do seu plano atual.</p><a class="btn btn-primary" href="/pages/assinatura.html">Comparar planos</a></div>';
}

if(requireAuth(['dono','gerente','recepcao'])){
  const requested=new URLSearchParams(location.search).get('secao');
  byId('shell').innerHTML=renderShell('gestao');
  tabsEl.innerHTML=GESTAO_TABS.map(([id,label])=>`<button type="button" class="tab-btn" data-tab="${id}">${label}</button>`).join('');
  tabsEl.addEventListener('click',e=>{const button=e.target.closest('[data-tab]');if(button)openTab(button.dataset.tab)});
  const initial=GESTAO_TABS.some(([id])=>id===requested)?requested:'pdv';
  const h1=document.querySelector('.topbar h1'),sub=document.querySelector('.topbar p');
  if(initial==='estoque'){document.title='Produtos & Estoque - EliteFlow';if(h1)h1.textContent='Produtos & Estoque';if(sub)sub.textContent='Produtos, preços, margens e controle de estoque da barbearia.'}
  else if(initial==='pdv'||initial==='vendas'){document.title='Vendas / PDV - EliteFlow';if(h1)h1.textContent='Vendas / PDV';if(sub)sub.textContent='Venda serviços e produtos e acompanhe o histórico do caixa.'}
  openTab(initial,false);
}

async function base(){
  const [cs,bs,ss]=await Promise.all([api('/clientes'),api('/barbeiros'),api('/servicos')]);
  return {cs,bs,ss};
}

async function openTab(tab,syncUrl=true){
  if(syncUrl){const url=new URL(location.href);url.searchParams.set('secao',tab);history.replaceState(null,'',url)}
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  loading();
  try{
    if(['pdv','vendas','estoque','comandas'].includes(tab)){
      if(!hasFeature('pdv_estoque')) return denied();
      if(tab==='pdv')return pdv();
      if(tab==='vendas')return vendas();
      if(tab==='comandas'){if(!hasFeature('comandas'))return denied();return comandas();}
      return estoque();
    }
    if(tab==='comissoes'){ if(!hasFeature('comissoes'))return denied(); return comissoes(); }
    if(tab==='fila'){ if(!hasFeature('fila_espera'))return denied(); return fila(); }
    if(tab==='crm'){ if(!hasFeature('crm_avancado'))return denied(); return crm(); }
    if(tab==='fidelidade'){ if(!hasFeature('fidelidade'))return denied(); return fidelidade(); }
    if(tab==='clube'){ if(!hasFeature('clube_assinaturas'))return denied(); return clube(); }
    if(tab==='fiscal'){ if(!hasFeature('fiscal_nfse'))return denied(); return fiscal(); }
    if(tab==='bi'){ if(!hasFeature('bi_avancado'))return denied(); return bi(); }
    if(tab==='oportunidades'){ if(!hasFeature('marketing_inteligente'))return denied(); return oportunidades(); }
    if(tab==='avaliacoes'){ if(!hasFeature('avaliacoes'))return denied(); return avaliacoes(); }
    if(tab==='relatorios'){ if(!hasFeature('relatorios_avancados'))return denied(); return relatorios(); }
    if(tab==='dados'){ if(!hasFeature('exportacao_dados'))return denied(); return dados(); }
    contentEl.innerHTML='<p class="muted">Área não encontrada.</p>';
  }catch(error){ showError(error); }
}

const estoqueState={produtos:[],fornecedores:[],busca:'',status:'todos',nivel:'todos'};
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
  const cols=canManage?6:5;
  contentEl.innerHTML=`
    <div class="section-head product-head"><div><h2>Produtos e estoque</h2><p>Controle produtos, fornecedores, compras, movimentações e consumo interno por serviço.</p></div>${canManage?'<div class="actions"><button class="btn btn-secondary" id="verFornecedores">Fornecedores</button><button class="btn btn-secondary" id="verCompras">Compras</button><button class="btn btn-secondary" id="verMovimentos">Movimentações</button><button class="btn btn-secondary" id="verInsumos">Insumos</button><button class="btn btn-primary" id="novoProduto">+ Novo produto</button></div>':''}</div>
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
      ${produtos.map(p=>{const n=productNumbers(p);return `<tr class="${p.ativo?'':'product-inactive-row'}"><td><div class="product-name product-name-photo"><div class="product-thumb">${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="" loading="lazy">`:'📦'}</div><div><strong>${esc(p.nome)}</strong><small>SKU: ${esc(p.sku||'sem SKU')}</small></div></div></td><td><strong>${money(n.preco)}</strong></td><td>${money(n.custo)}<small class="product-margin">Margem ${productMargin(p).toFixed(0)}%</small></td><td><div class="product-stock"><strong>${n.estoque.toLocaleString('pt-BR')}</strong><small>Mín. ${n.minimo.toLocaleString('pt-BR')}</small>${productStockBadge(p)}</div></td><td><span class="badge ${p.ativo?'product-active':'product-inactive'}">${p.ativo?'Ativo':'Inativo'}</span></td>${canManage?`<td><div class="product-actions"><button type="button" class="btn btn-secondary" data-prod-edit="${p.id}">Editar</button><button type="button" class="btn btn-secondary" data-prod-stock="${p.id}">Estoque</button><button type="button" class="btn ${p.ativo?'btn-danger':'btn-success'}" data-prod-toggle="${p.id}">${p.ativo?'Desativar':'Ativar'}</button><button type="button" class="btn btn-danger btn-outline-danger" data-prod-delete="${p.id}">Excluir</button></div></td>`:''}</tr>`}).join('')||`<tr><td colspan="${cols}"><div class="product-empty"><strong>Nenhum produto encontrado</strong><span>${estoqueState.produtos.length?'Ajuste os filtros para ver outros itens.':'Cadastre o primeiro produto para começar a controlar o estoque.'}</span></div></td></tr>`}
    </tbody></table></div>`;

  byId('produtoBusca').addEventListener('input',e=>{estoqueState.busca=e.target.value;renderEstoque();byId('produtoBusca')?.focus()});
  byId('produtoStatus').addEventListener('change',e=>{estoqueState.status=e.target.value;renderEstoque()});
  byId('produtoNivel').addEventListener('change',e=>{estoqueState.nivel=e.target.value;renderEstoque()});
  if(canManage){
    byId('novoProduto')?.addEventListener('click',()=>openProductModal());byId('verFornecedores')?.addEventListener('click',fornecedores);byId('verCompras')?.addEventListener('click',compras);byId('verMovimentos')?.addEventListener('click',movimentosEstoque);byId('verInsumos')?.addEventListener('click',insumosServicos);
    contentEl.querySelectorAll('[data-prod-edit]').forEach(b=>b.addEventListener('click',()=>openProductModal(findProduct(b.dataset.prodEdit))));
    contentEl.querySelectorAll('[data-prod-stock]').forEach(b=>b.addEventListener('click',()=>openStockModal(findProduct(b.dataset.prodStock))));
    contentEl.querySelectorAll('[data-prod-toggle]').forEach(b=>b.addEventListener('click',()=>toggleProduct(findProduct(b.dataset.prodToggle))));
    contentEl.querySelectorAll('[data-prod-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(findProduct(b.dataset.prodDelete))));
  }
  initResponsiveTables();
}
function findProduct(id){return estoqueState.produtos.find(p=>String(p.id)===String(id))}
async function estoque(){
  const [produtos,fornecedoresLista]=await Promise.all([api('/operacao/produtos'),hasRole('dono','gerente')?api('/avancado/fornecedores'):Promise.resolve([])]);
  estoqueState.produtos=produtos;estoqueState.fornecedores=fornecedoresLista;
  renderEstoque();
}
function closeProductModal(){document.getElementById('productModal')?.remove()}
function productPayload(p,override={}){const n=productNumbers(p||{});return{nome:p?.nome||'',sku:p?.sku||'',preco:n.preco,custo:n.custo,estoque:n.estoque,estoque_minimo:n.minimo,imagem_url:p?.imagem_url||'',fornecedor_id:p?.fornecedor_id||null,unidade:p?.unidade||'un',validade:p?.validade?String(p.validade).slice(0,10):'',ativo:p?.ativo!==false,...override}}
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
        <div class="field"><label>Fornecedor</label><select id="produtoFornecedor"><option value="">Sem fornecedor</option>${estoqueState.fornecedores.filter(x=>x.ativo).map(x=>`<option value="${x.id}" ${String(x.id)===String(p.fornecedor_id||'')?'selected':''}>${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Unidade</label><select id="produtoUnidade"><option value="un" ${p.unidade==='un'?'selected':''}>un</option><option value="ml" ${p.unidade==='ml'?'selected':''}>ml</option><option value="g" ${p.unidade==='g'?'selected':''}>g</option><option value="l" ${p.unidade==='l'?'selected':''}>litro</option><option value="kg" ${p.unidade==='kg'?'selected':''}>kg</option></select></div><div class="field"><label>Validade</label><input id="produtoValidade" type="date" value="${esc(p.validade||'')}"></div>
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
    const body={nome:byId('produtoNome').value.trim(),sku:byId('produtoSku').value.trim(),preco:byId('produtoPreco').value,custo:byId('produtoCusto').value,estoque:byId('produtoEstoque').value,estoque_minimo:byId('produtoMinimo').value,imagem_url:byId('produtoImagemUrl').value.trim(),fornecedor_id:byId('produtoFornecedor')?.value||null,unidade:byId('produtoUnidade')?.value||'un',validade:byId('produtoValidade')?.value||null,ativo:byId('produtoAtivo').checked};
    if(!body.nome)throw new Error('Informe o nome do produto.');
    await api(editing?`/operacao/produtos/${produto.id}`:'/operacao/produtos',{method:editing?'PUT':'POST',body:JSON.stringify(body)});closeProductModal();await estoque();flash(msgEl,editing?'Produto atualizado.':'Produto cadastrado.');
  }catch(error){err.textContent=error.message;err.classList.remove('hidden');btn.disabled=false}});
  byId('produtoNome').focus();
}
function openStockModal(produto){if(!produto)return;closeProductModal();const n=productNumbers(produto),modal=document.createElement('div');modal.id='productModal';modal.className='modal';modal.innerHTML=`<div class="modal-box stock-modal-box"><div class="modal-head"><div><h2>Ajustar estoque</h2><p class="muted">${esc(produto.nome)}</p></div><button type="button" class="close" id="fecharProduto">×</button></div><div class="stock-adjust-current"><span>Estoque atual</span><strong id="stockPreview">${n.estoque}</strong></div><div class="stock-quick-actions"><button class="btn btn-secondary" type="button" data-stock-delta="-5">−5</button><button class="btn btn-secondary" type="button" data-stock-delta="-1">−1</button><button class="btn btn-secondary" type="button" data-stock-delta="1">+1</button><button class="btn btn-secondary" type="button" data-stock-delta="5">+5</button></div><div class="field"><label>Nova quantidade</label><input id="stockValue" type="number" min="0" step="1" value="${n.estoque}"></div><div id="produtoModalMsg" class="notice error hidden"></div><div class="actions product-modal-actions"><button class="btn btn-secondary" type="button" id="cancelarProduto">Cancelar</button><button class="btn btn-primary" type="button" id="salvarEstoque">Salvar estoque</button></div></div>`;document.body.appendChild(modal);
  const input=byId('stockValue'),preview=byId('stockPreview'),sync=()=>preview.textContent=Math.max(0,Number(input.value||0)).toLocaleString('pt-BR');input.addEventListener('input',sync);modal.querySelectorAll('[data-stock-delta]').forEach(b=>b.addEventListener('click',()=>{input.value=Math.max(0,Number(input.value||0)+Number(b.dataset.stockDelta));sync()}));byId('fecharProduto').addEventListener('click',closeProductModal);byId('cancelarProduto').addEventListener('click',closeProductModal);modal.addEventListener('click',e=>{if(e.target===modal)closeProductModal()});byId('salvarEstoque').addEventListener('click',async()=>{const err=byId('produtoModalMsg');try{const nova=Number(input.value),delta=nova-n.estoque;if(Math.abs(delta)>0.0001)await api('/avancado/estoque/ajustar',{method:'POST',body:JSON.stringify({produto_id:produto.id,tipo:'ajuste',quantidade:delta,observacoes:'Ajuste manual pelo painel'})});closeProductModal();await estoque();flash(msgEl,'Estoque atualizado.')}catch(error){err.textContent=error.message;err.classList.remove('hidden')}});input.focus();input.select();
}
async function toggleProduct(produto){if(!produto)return;const action=produto.ativo?'desativar':'ativar';if(!confirm(`Deseja ${action} "${produto.nome}"?`))return;try{await api(`/operacao/produtos/${produto.id}`,{method:'PUT',body:JSON.stringify(productPayload(produto,{ativo:!produto.ativo}))});await estoque();flash(msgEl,`Produto ${produto.ativo?'desativado':'ativado'}.`)}catch(error){flash(msgEl,error.message,'error')}}
async function deleteProduct(produto){if(!produto)return;if(!confirm(`Excluir permanentemente "${produto.nome}"?\n\nAs vendas antigas continuarão preservadas no histórico, mas o produto sairá do catálogo.`))return;try{await api(`/operacao/produtos/${produto.id}`,{method:'DELETE'});await estoque();flash(msgEl,'Produto excluído com sucesso.')}catch(error){flash(msgEl,error.message,'error')}}

async function vendas(){
  const rows=await api('/operacao/vendas');
  contentEl.innerHTML=`<div class="section-head"><div><h2>Histórico de vendas</h2><p>Últimas vendas finalizadas no caixa, com cliente, profissional e forma de pagamento.</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Cliente</th><th>Barbeiro</th><th>Serviços</th><th>Produtos</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${new Date(x.criado_em).toLocaleString('pt-BR')}</td><td>${esc(x.cliente||'Avulso')}</td><td>${esc(x.barbeiro||'—')}</td><td>${money(x.subtotal_servicos)}</td><td>${money(x.subtotal_produtos)}</td><td>${esc(String(x.forma_pagamento||'').replace('_',' '))}</td><td><strong>${money(x.total)}</strong></td></tr>`).join('')||'<tr><td colspan="7">Nenhuma venda registrada.</td></tr>'}</tbody></table></div>`;
  initResponsiveTables();
}

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
  a.href=URL.createObjectURL(blob); a.download=`eliteflow-${tipo}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

// ===== EliteFlow 3.0 — operação avançada =====
async function comandas(){
  const [{cs,bs},abertas,ags]=await Promise.all([base(),api('/avancado/comandas?status=aberta'),api('/agendamentos?inicio='+new Date().toISOString().slice(0,10))]);
  contentEl.innerHTML=`<div class="section-head"><div><h2>Comandas</h2><p>Abra pelo agendamento ou manualmente e feche tudo no caixa.</p></div></div>
  <div class="form-grid three"><div class="field"><label>Agendamento</label><select id="cmdAg"><option value="">Sem agendamento</option>${ags.filter(x=>!['cancelado','concluido','nao_compareceu'].includes(x.status)).slice(0,80).map(x=>`<option value="${x.id}">${dateBR(x.data)} ${String(x.horario).slice(0,5)} — ${esc(x.cliente)} / ${esc(x.servico)}</option>`).join('')}</select></div><div class="field"><label>Cliente (manual)</label><select id="cmdCli"><option value="">Opcional</option>${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Barbeiro (manual)</label><select id="cmdBarb"><option value="">Opcional</option>${bs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div></div><button class="btn btn-primary" id="abrirComanda">+ Abrir comanda</button>
  <h3 style="margin-top:24px">Em atendimento</h3><div class="cards">${abertas.map(x=>`<div class="card"><div class="label">Comanda #${x.id}</div><div class="value">${money(x.total)}</div><strong>${esc(x.cliente||'Cliente avulso')}</strong><p>${esc(x.barbeiro||'Sem barbeiro')}</p><button class="btn btn-secondary" data-cmd="${x.id}">Abrir</button></div>`).join('')||'<p class="muted">Nenhuma comanda aberta.</p>'}</div>`;
  byId('abrirComanda').onclick=async()=>{try{const r=await api('/avancado/comandas',{method:'POST',body:JSON.stringify({agendamento_id:byId('cmdAg').value||null,cliente_id:byId('cmdCli').value||null,barbeiro_id:byId('cmdBarb').value||null})});return comandaDetalhe(r.id)}catch(e){alert(e.message)}};
  contentEl.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>comandaDetalhe(b.dataset.cmd));
}
async function comandaDetalhe(id){
  const [c,{ss},produtos]=await Promise.all([api('/avancado/comandas/'+id),base(),api('/operacao/produtos')]);
  contentEl.innerHTML=`<div class="section-head"><div><h2>Comanda #${c.id}</h2><p>${esc(c.cliente||'Cliente avulso')} · ${esc(c.barbeiro||'Sem barbeiro')}</p></div><button class="btn btn-secondary" id="voltarCmd">← Comandas</button></div>
  <div class="cards compact-cards"><div class="card"><div class="label">Serviços</div><div class="value">${money(c.subtotal_servicos)}</div></div><div class="card"><div class="label">Produtos</div><div class="value">${money(c.subtotal_produtos)}</div></div><div class="card"><div class="label">Desconto</div><div class="value">${money(c.desconto)}</div></div><div class="card"><div class="label">Total</div><div class="value">${money(c.total)}</div></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Tipo</th><th>Qtd.</th><th>Unit.</th><th>Subtotal</th><th></th></tr></thead><tbody>${c.itens.map(i=>`<tr><td>${esc(i.descricao)}</td><td>${esc(i.tipo)}</td><td>${Number(i.quantidade)}</td><td>${money(i.valor_unitario)}</td><td>${money(i.subtotal)}</td><td><button class="btn btn-danger" data-rm-item="${i.id}">×</button></td></tr>`).join('')||'<tr><td colspan="6">Sem itens.</td></tr>'}</tbody></table></div>
  <h3>Adicionar item</h3><div class="form-grid three"><div class="field"><label>Tipo</label><select id="cmdTipo"><option value="servico">Serviço</option><option value="produto">Produto</option><option value="extra">Extra</option></select></div><div class="field"><label>Serviço / produto</label><select id="cmdRef">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)}</option>`).join('')}</select></div><div class="field"><label>Quantidade</label><input id="cmdQtd" type="number" min="1" value="1"></div><div class="field hidden" id="extraDescField"><label>Descrição extra</label><input id="cmdExtraDesc"></div><div class="field hidden" id="extraValorField"><label>Valor</label><input id="cmdExtraValor" type="number" min="0" step="0.01"></div></div><button class="btn btn-secondary" id="cmdAdd">Adicionar</button>
  <hr><div class="form-grid three"><div class="field"><label>Desconto</label><input id="cmdDesconto" type="number" min="0" step="0.01" value="${Number(c.desconto||0)}"></div><div class="field"><label>Pagamento</label><select id="cmdPg"><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="mercado_pago">Mercado Pago</option><option value="pix_manual">Pix manual</option></select></div></div><div class="actions"><button class="btn btn-secondary" id="cmdSalvarDesc">Aplicar desconto</button><button class="btn btn-primary" id="cmdFechar">Fechar comanda</button></div>`;
  byId('voltarCmd').onclick=comandas;
  const updateRef=()=>{const tipo=byId('cmdTipo').value,ref=byId('cmdRef');byId('extraDescField').classList.toggle('hidden',tipo!=='extra');byId('extraValorField').classList.toggle('hidden',tipo!=='extra');ref.closest('.field').classList.toggle('hidden',tipo==='extra');ref.innerHTML=(tipo==='produto'?produtos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)} · estoque ${Number(x.estoque)}</option>`):ss.map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)}</option>`)).join('')};
  byId('cmdTipo').onchange=updateRef;updateRef();
  byId('cmdAdd').onclick=async()=>{try{const tipo=byId('cmdTipo').value;await api(`/avancado/comandas/${id}/itens`,{method:'POST',body:JSON.stringify({tipo,referencia_id:tipo==='extra'?null:byId('cmdRef').value,quantidade:byId('cmdQtd').value,descricao:byId('cmdExtraDesc').value,valor_unitario:byId('cmdExtraValor').value})});await comandaDetalhe(id)}catch(e){alert(e.message)}};
  contentEl.querySelectorAll('[data-rm-item]').forEach(b=>b.onclick=async()=>{try{await api(`/avancado/comandas/${id}/itens/${b.dataset.rmItem}`,{method:'DELETE'});await comandaDetalhe(id)}catch(e){alert(e.message)}});
  byId('cmdSalvarDesc').onclick=async()=>{try{await api('/avancado/comandas/'+id,{method:'PATCH',body:JSON.stringify({desconto:byId('cmdDesconto').value})});await comandaDetalhe(id)}catch(e){alert(e.message)}};
  byId('cmdFechar').onclick=async()=>{if(!confirm('Fechar esta comanda e registrar a venda?'))return;try{const r=await api(`/avancado/comandas/${id}/fechar`,{method:'POST',body:JSON.stringify({forma_pagamento:byId('cmdPg').value})});alert(`Comanda fechada: ${money(r.total)}`);await comandas()}catch(e){alert(e.message)}};
  initResponsiveTables();
}

async function clube(){
  const [{cs,ss},planos,assinaturas]=await Promise.all([base(),api('/avancado/clube/planos'),api('/avancado/clube/assinaturas')]);
  contentEl.innerHTML=`<h2>Clube de Assinaturas</h2><p>Recorrência operacional: planos, clientes, franquia mensal e inadimplência. A cobrança automática depende do gateway configurado.</p><div class="cards compact-cards"><div class="card"><div class="label">Planos ativos</div><div class="value">${planos.filter(x=>x.ativo).length}</div></div><div class="card"><div class="label">Assinantes ativos</div><div class="value">${assinaturas.filter(x=>x.status==='ativa').length}</div></div><div class="card"><div class="label">MRR estimado</div><div class="value">${money(assinaturas.filter(x=>x.status==='ativa').reduce((a,x)=>a+Number(x.preco_mensal||0),0))}</div></div></div>
  <div class="two-columns"><div><h3>Novo plano</h3><div class="field"><label>Nome</label><input id="clubeNome" placeholder="Corte Mensal"></div><div class="form-grid"><div class="field"><label>Preço mensal</label><input id="clubePreco" type="number" step="0.01"></div><div class="field"><label>Dia cobrança (1–28)</label><input id="clubeDia" type="number" min="1" max="28" value="10"></div><div class="field"><label>Serviço incluído</label><select id="clubeServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Qtd./mês</label><input id="clubeQtd" type="number" min="1" value="1"></div></div><button class="btn btn-primary" id="criarClubePlano">Criar plano</button></div>
  <div><h3>Novo assinante</h3><div class="field"><label>Cliente</label><select id="clubeCliente">${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Plano</label><select id="clubePlano">${planos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco_mensal)}</option>`).join('')}</select></div><button class="btn btn-secondary" id="assinarClube">Adicionar assinante</button></div></div>
  <h3>Assinaturas</h3><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Plano</th><th>Status</th><th>Próxima cobrança</th><th>Consumos mês</th><th>Ação</th></tr></thead><tbody>${assinaturas.map(x=>`<tr><td>${esc(x.cliente)}</td><td>${esc(x.plano)}</td><td>${esc(x.status)}</td><td>${x.proxima_cobranca?dateBR(x.proxima_cobranca):'-'}</td><td>${x.consumos_mes}</td><td><button class="btn btn-secondary" data-clube-use="${x.id}" data-plano="${x.plano_id}">Registrar uso</button> <select data-clube-status="${x.id}"><option ${x.status==='ativa'?'selected':''}>ativa</option><option ${x.status==='pausada'?'selected':''}>pausada</option><option ${x.status==='inadimplente'?'selected':''}>inadimplente</option><option ${x.status==='cancelada'?'selected':''}>cancelada</option></select></td></tr>`).join('')||'<tr><td colspan="6">Sem assinantes.</td></tr>'}</tbody></table></div>`;
  byId('criarClubePlano').onclick=async()=>{try{await api('/avancado/clube/planos',{method:'POST',body:JSON.stringify({nome:byId('clubeNome').value,preco_mensal:byId('clubePreco').value,dia_cobranca:byId('clubeDia').value,servicos:[{servico_id:byId('clubeServico').value,quantidade:byId('clubeQtd').value}]})});await clube()}catch(e){alert(e.message)}};
  byId('assinarClube').onclick=async()=>{try{await api('/avancado/clube/assinaturas',{method:'POST',body:JSON.stringify({cliente_id:byId('clubeCliente').value,plano_id:byId('clubePlano').value})});await clube()}catch(e){alert(e.message)}};
  contentEl.querySelectorAll('[data-clube-status]').forEach(el=>el.onchange=async()=>{try{await api('/avancado/clube/assinaturas/'+el.dataset.clubeStatus,{method:'PATCH',body:JSON.stringify({status:el.value})})}catch(e){alert(e.message)}});initResponsiveTables();
}

async function crm(){
  const rows=await api('/avancado/crm');
  contentEl.innerHTML=`<div class="section-head"><div><h2>CRM avançado</h2><p>Segmentação automática por comportamento, valor e recência.</p></div></div><div class="cards compact-cards">${['vip','fiel','risco','inativo'].map(seg=>`<div class="card"><div class="label">${seg.toUpperCase()}</div><div class="value">${rows.filter(x=>x.segmento===seg).length}</div></div>`).join('')}</div><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Segmento</th><th>Visitas</th><th>Total gasto</th><th>Última visita</th><th>Pontos</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.nome)}</strong><small>${esc(x.telefone)}</small></td><td><span class="badge">${esc(x.segmento)}</span></td><td>${x.visitas}</td><td>${money(x.total_gasto)}</td><td>${x.ultima_visita?dateBR(x.ultima_visita):'-'}</td><td>${x.pontos}</td><td><button class="btn btn-secondary" data-crm-detail="${x.id}">Perfil</button></td></tr>`).join('')||'<tr><td colspan="7">Sem clientes.</td></tr>'}</tbody></table></div>`;
  contentEl.querySelectorAll('[data-crm-detail]').forEach(b=>b.onclick=()=>crmDetalhe(b.dataset.crmDetail));initResponsiveTables();
}
async function crmDetalhe(id){const [r,tags]=await Promise.all([api('/avancado/crm/'+id),api('/avancado/crm-tags')]);contentEl.innerHTML=`<button class="btn btn-secondary" id="crmBack">← CRM</button><h2>${esc(r.cliente.nome)}</h2><div class="cards compact-cards"><div class="card"><div class="label">Visitas</div><div class="value">${r.metricas.visitas||0}</div></div><div class="card"><div class="label">Total gasto</div><div class="value">${money(r.metricas.total_gasto)}</div></div><div class="card"><div class="label">Ticket médio</div><div class="value">${money(r.metricas.ticket_medio)}</div></div><div class="card"><div class="label">Frequência</div><div class="value">${r.metricas.frequencia_dias||'-'} d</div></div><div class="card"><div class="label">No-show</div><div class="value">${r.metricas.faltas||0}</div></div><div class="card"><div class="label">Pontos</div><div class="value">${r.fidelidade.pontos}</div></div></div><h3>Etiquetas</h3><div class="inline-row"><select id="crmTag">${tags.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select><button class="btn btn-secondary" id="crmAddTag">Adicionar</button><button class="btn btn-secondary" id="crmNewTag">Nova etiqueta</button></div><p>${r.tags.map(x=>`<span class="badge">${esc(x.nome)}</span>`).join(' ')||'Sem etiquetas.'}</p><h3>Clube</h3>${r.clube.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><span>${esc(x.status)} · ${money(x.preco_mensal)}/mês</span></div>`).join('')||'<p class="muted">Sem assinatura.</p>'}<h3>Pacotes</h3>${r.pacotes.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><span>${esc(x.status)} · expira ${x.expira_em?dateBR(x.expira_em):'-'}</span></div>`).join('')||'<p class="muted">Sem pacotes.</p>'}<h3>Histórico</h3><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Valor</th></tr></thead><tbody>${r.historico.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${esc(x.servico)}</td><td>${esc(x.barbeiro)}</td><td>${esc(x.status)}</td><td>${money(x.valor)}</td></tr>`).join('')}</tbody></table></div>`;byId('crmBack').onclick=crm;byId('crmAddTag').onclick=async()=>{try{await api(`/avancado/crm/${id}/tags/${byId('crmTag').value}`,{method:'POST',body:'{}'});await crmDetalhe(id)}catch(e){alert(e.message)}};byId('crmNewTag').onclick=async()=>{const nome=prompt('Nome da etiqueta');if(!nome)return;try{await api('/avancado/crm-tags',{method:'POST',body:JSON.stringify({nome})});await crmDetalhe(id)}catch(e){alert(e.message)}};initResponsiveTables()}

async function fila(){
 const [{cs,bs,ss},itens]=await Promise.all([base(),api('/avancado/fila')]);
 contentEl.innerHTML=`<h2>Fila inteligente</h2><p>Cadastre preferências e avise pelo WhatsApp quando surgir vaga.</p><div class="form-grid three"><div class="field"><label>Cliente</label><select id="filaCliente">${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Serviço</label><select id="filaServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Barbeiro</label><select id="filaBarbeiro"><option value="">Qualquer</option>${bs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Data preferida</label><input id="filaData" type="date"></div><div class="field"><label>Entre</label><input id="filaInicio" type="time"></div><div class="field"><label>e</label><input id="filaFim" type="time"></div></div><button class="btn btn-primary" id="adicionarFila">Adicionar</button><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Serviço</th><th>Preferência</th><th>Status</th><th>Ações</th></tr></thead><tbody>${itens.map(x=>`<tr><td>${esc(x.cliente)}</td><td>${esc(x.servico)}<small>${esc(x.barbeiro||'Qualquer')}</small></td><td>${x.data_preferida?dateBR(x.data_preferida):'Qualquer dia'} ${x.hora_inicio?String(x.hora_inicio).slice(0,5):''}</td><td>${esc(x.status)}</td><td><button class="btn btn-secondary" data-fila-notify="${x.id}">Avisar WhatsApp</button><button class="btn btn-secondary" data-fila-done="${x.id}">Atendido</button></td></tr>`).join('')||'<tr><td colspan="5">Fila vazia.</td></tr>'}</tbody></table></div>`;
 byId('adicionarFila').onclick=async()=>{try{await api('/avancado/fila',{method:'POST',body:JSON.stringify({cliente_id:byId('filaCliente').value,servico_id:byId('filaServico').value,barbeiro_id:byId('filaBarbeiro').value||null,data_preferida:byId('filaData').value||null,hora_inicio:byId('filaInicio').value||null,hora_fim:byId('filaFim').value||null})});await fila()}catch(e){alert(e.message)}};contentEl.querySelectorAll('[data-fila-notify]').forEach(b=>b.onclick=async()=>{try{const r=await api('/avancado/fila/'+b.dataset.filaNotify+'/notificar',{method:'POST',body:'{}'});alert(`${r.notificados} cliente(s) avisado(s).`);await fila()}catch(e){alert(e.message)}});contentEl.querySelectorAll('[data-fila-done]').forEach(b=>b.onclick=async()=>{await api('/avancado/fila/'+b.dataset.filaDone,{method:'PATCH',body:JSON.stringify({status:'atendido'})});await fila()});initResponsiveTables();
}

async function fiscal(){
 const [cfg,docs,sales]=await Promise.all([api('/avancado/fiscal/config'),api('/avancado/fiscal/documentos'),api('/operacao/vendas')]);
 contentEl.innerHTML=`<h2>Fiscal / NFS-e</h2><div class="notice ${cfg.integracao_disponivel?'success':'warning'}">${cfg.integracao_disponivel?'Adaptador externo NFS-e disponível no ambiente.':'Modo seguro de preparação: a emissão automática exige NFSE_API_URL + credenciais/certificado do provedor fiscal.'}</div><div class="form-grid three"><label class="check"><input id="fiscalAtivo" type="checkbox" ${cfg.ativo?'checked':''}> Ativar fiscal</label><div class="field"><label>Modo</label><select id="fiscalProv"><option value="manual" ${cfg.provedor==='manual'?'selected':''}>Preparação manual</option><option value="custom" ${cfg.provedor==='custom'?'selected':''}>Provedor/API</option></select></div><div class="field"><label>Código do serviço</label><input id="fiscalCodigo" value="${esc(cfg.codigo_servico||'')}"></div><div class="field"><label>Item lista serviço</label><input id="fiscalItem" value="${esc(cfg.item_lista_servico||'')}"></div><div class="field"><label>Alíquota ISS %</label><input id="fiscalAliq" type="number" step="0.0001" value="${cfg.aliquota_iss??''}"></div><div class="field"><label>Inscrição municipal</label><input id="fiscalIM" value="${esc(cfg.inscricao_municipal||'')}"></div></div><button class="btn btn-primary" id="saveFiscal">Salvar fiscal</button><hr><h3>Preparar documento a partir de venda</h3><div class="inline-row"><select id="fiscalVenda">${sales.slice(0,200).map(x=>`<option value="${x.id}">#${x.id} · ${esc(x.cliente||'Cliente')} · ${money(x.total)}</option>`).join('')}</select><button class="btn btn-secondary" id="prepFiscal">Preparar NFS-e</button></div><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Venda</th><th>Valor serviço</th><th>Status</th><th>Número</th><th></th></tr></thead><tbody>${docs.map(x=>`<tr><td>${x.id}</td><td>#${x.venda_id||'-'} ${esc(x.cliente||'')}</td><td>${money(x.valor)}</td><td>${esc(x.status)}</td><td>${esc(x.numero||'-')}</td><td>${x.status==='rascunho'||x.status==='erro'?`<button class="btn btn-secondary" data-emit="${x.id}">Emitir</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6">Sem documentos.</td></tr>'}</tbody></table></div>`;
 byId('saveFiscal').onclick=async()=>{try{await api('/avancado/fiscal/config',{method:'PUT',body:JSON.stringify({ativo:byId('fiscalAtivo').checked,provedor:byId('fiscalProv').value,codigo_servico:byId('fiscalCodigo').value,item_lista_servico:byId('fiscalItem').value,aliquota_iss:byId('fiscalAliq').value,inscricao_municipal:byId('fiscalIM').value})});alert('Fiscal salvo.')}catch(e){alert(e.message)}};byId('prepFiscal').onclick=async()=>{try{await api('/avancado/fiscal/documentos',{method:'POST',body:JSON.stringify({venda_id:byId('fiscalVenda').value})});await fiscal()}catch(e){alert(e.message)}};contentEl.querySelectorAll('[data-emit]').forEach(b=>b.onclick=async()=>{try{await api('/avancado/fiscal/documentos/'+b.dataset.emit+'/emitir',{method:'POST',body:'{}'});await fiscal()}catch(e){alert(e.message)}});initResponsiveTables();
}

async function bi(){
 const r=await api('/avancado/bi/resumo'),k=r.kpis;
 contentEl.innerHTML=`<div class="section-head"><div><h2>BI Gerencial</h2><p>${dateBR(r.periodo.inicio)} a ${dateBR(r.periodo.fim)}</p></div></div><div class="cards"><div class="card"><div class="label">Receita</div><div class="value">${money(k.receita)}</div></div><div class="card"><div class="label">Ticket médio</div><div class="value">${money(k.ticket_medio)}</div></div><div class="card"><div class="label">Conclusão</div><div class="value">${k.taxa_conclusao}%</div></div><div class="card"><div class="label">No-show</div><div class="value">${k.taxa_no_show}%</div></div><div class="card"><div class="label">Clientes novos</div><div class="value">${k.clientes_novos}</div></div><div class="card"><div class="label">Recorrentes</div><div class="value">${k.clientes_recorrentes}</div></div><div class="card"><div class="label">MRR clube</div><div class="value">${money(r.clube.mrr)}</div></div><div class="card"><div class="label">Fila</div><div class="value">${r.fila.aguardando}</div></div></div><div class="two-columns"><div><h3>Top barbeiros</h3>${r.top_barbeiros.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><span>${x.atendimentos} · ${money(x.receita)}</span></div>`).join('')||'<p class="muted">Sem dados.</p>'}</div><div><h3>Top serviços</h3>${r.top_servicos.map(x=>`<div class="inline-row"><strong>${esc(x.nome)}</strong><span>${x.quantidade} · ${money(x.receita)}</span></div>`).join('')||'<p class="muted">Sem dados.</p>'}</div></div><h3>Receita diária</h3><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Receita</th></tr></thead><tbody>${r.tendencia.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${money(x.receita)}</td></tr>`).join('')}</tbody></table></div>`;initResponsiveTables();
}

async function oportunidades(){
 const r=await api('/avancado/marketing/oportunidades');contentEl.innerHTML=`<h2>Oportunidades inteligentes</h2><div class="notice">${esc(r.insight)}</div><div class="cards">${r.oportunidades.map(x=>`<div class="card"><div class="label">${esc(x.titulo)}</div><div class="value">${x.publico}</div><p>${esc(x.mensagem)}</p><a class="btn btn-secondary" href="/pages/marketing.html?secao=campanhas">Criar campanha</a></div>`).join('')||'<p class="muted">Nenhuma oportunidade relevante detectada agora.</p>'}</div>`;
}


// ===== Estoque profissional =====
async function fornecedores(){
  const rows=await api('/avancado/fornecedores');
  contentEl.innerHTML=`<div class="section-head"><div><h2>Fornecedores</h2><p>Base de compras e reposição de estoque.</p></div><div class="actions"><button class="btn btn-secondary" id="backEstoque">← Produtos</button><button class="btn btn-primary" id="novoFornecedor">+ Fornecedor</button></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Fornecedor</th><th>Contato</th><th>Documento</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.nome)}</strong><small>${esc(x.email||'')}</small></td><td>${esc(x.contato||x.telefone||'-')}</td><td>${esc(x.documento||'-')}</td><td>${x.ativo?'Ativo':'Inativo'}</td><td><button class="btn btn-secondary" data-forn-toggle="${x.id}" data-active="${x.ativo}">${x.ativo?'Desativar':'Ativar'}</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhum fornecedor.</td></tr>'}</tbody></table></div>`;
  byId('backEstoque').onclick=estoque;byId('novoFornecedor').onclick=async()=>{const nome=prompt('Nome do fornecedor');if(!nome)return;const telefone=prompt('Telefone (opcional)','')||'',email=prompt('E-mail (opcional)','')||'';try{await api('/avancado/fornecedores',{method:'POST',body:JSON.stringify({nome,telefone,email})});await fornecedores()}catch(e){alert(e.message)}};contentEl.querySelectorAll('[data-forn-toggle]').forEach(b=>b.onclick=async()=>{try{await api('/avancado/fornecedores/'+b.dataset.fornToggle,{method:'PATCH',body:JSON.stringify({ativo:b.dataset.active!=='true'})});await fornecedores()}catch(e){alert(e.message)}});initResponsiveTables();
}
async function movimentosEstoque(){
  const rows=await api('/avancado/estoque/movimentos');contentEl.innerHTML=`<div class="section-head"><div><h2>Movimentações de estoque</h2><p>Rastreabilidade de entradas, saídas, vendas, compras e consumo de insumos.</p></div><button class="btn btn-secondary" id="backEstoque">← Produtos</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Movimento</th><th>Antes → Depois</th><th>Referência</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${new Date(x.criado_em).toLocaleString('pt-BR')}</td><td>${esc(x.produto)}</td><td>${esc(x.tipo)}</td><td><strong>${Number(x.quantidade)>0?'+':''}${Number(x.quantidade).toLocaleString('pt-BR')}</strong></td><td>${Number(x.estoque_anterior).toLocaleString('pt-BR')} → ${Number(x.estoque_posterior).toLocaleString('pt-BR')}</td><td>${esc(x.referencia_tipo||x.observacoes||'-')}</td></tr>`).join('')||'<tr><td colspan="6">Sem movimentações.</td></tr>'}</tbody></table></div>`;byId('backEstoque').onclick=estoque;initResponsiveTables();
}
async function compras(){
  const [pedidos,forns,produtos]=await Promise.all([api('/avancado/compras'),api('/avancado/fornecedores'),api('/operacao/produtos')]);contentEl.innerHTML=`<div class="section-head"><div><h2>Compras e reposição</h2><p>Registre pedidos e receba mercadorias com atualização automática de custo médio e estoque.</p></div><div class="actions"><button class="btn btn-secondary" id="backEstoque">← Produtos</button><button class="btn btn-primary" id="novaCompra">+ Compra</button></div></div><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Fornecedor</th><th>Status</th><th>Itens</th><th>Total</th><th>Data</th><th></th></tr></thead><tbody>${pedidos.map(x=>`<tr><td>#${x.id}</td><td>${esc(x.fornecedor||'Sem fornecedor')}</td><td>${esc(x.status)}</td><td>${x.itens}</td><td>${money(x.total)}</td><td>${new Date(x.criado_em).toLocaleDateString('pt-BR')}</td><td><button class="btn btn-secondary" data-compra="${x.id}">Abrir</button></td></tr>`).join('')||'<tr><td colspan="7">Nenhuma compra.</td></tr>'}</tbody></table></div>`;byId('backEstoque').onclick=estoque;byId('novaCompra').onclick=async()=>{try{const fornecedor=forns.find(x=>x.ativo)?.id||null;const r=await api('/avancado/compras',{method:'POST',body:JSON.stringify({fornecedor_id:fornecedor})});await compraDetalhe(r.id)}catch(e){alert(e.message)}};contentEl.querySelectorAll('[data-compra]').forEach(b=>b.onclick=()=>compraDetalhe(b.dataset.compra));initResponsiveTables();
}
async function compraDetalhe(id){
 const [r,produtos]=await Promise.all([api('/avancado/compras/'+id),api('/operacao/produtos')]);const edit=['rascunho','aberto'].includes(r.status);contentEl.innerHTML=`<div class="section-head"><div><h2>Compra #${r.id}</h2><p>${esc(r.fornecedor||'Sem fornecedor')} · ${esc(r.status)}</p></div><button class="btn btn-secondary" id="backCompras">← Compras</button></div><div class="cards compact-cards"><div class="card"><div class="label">Total</div><div class="value">${money(r.total)}</div></div><div class="card"><div class="label">Itens</div><div class="value">${r.itens.length}</div></div></div>${edit?`<div class="form-grid three"><div class="field"><label>Produto</label><select id="compraProduto">${produtos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Quantidade</label><input id="compraQtd" type="number" min="0.001" step="0.001" value="1"></div><div class="field"><label>Custo unitário</label><input id="compraCusto" type="number" min="0" step="0.01" value="0"></div></div><button class="btn btn-secondary" id="addCompraItem">Adicionar item</button>`:''}<div class="table-wrap"><table class="table"><thead><tr><th>Produto</th><th>Qtd.</th><th>Custo</th><th>Subtotal</th></tr></thead><tbody>${r.itens.map(x=>`<tr><td>${esc(x.produto)}</td><td>${Number(x.quantidade)}</td><td>${money(x.custo_unitario)}</td><td>${money(x.subtotal)}</td></tr>`).join('')||'<tr><td colspan="4">Sem itens.</td></tr>'}</tbody></table></div>${edit?'<div class="actions"><button class="btn btn-danger" id="cancelCompra">Cancelar compra</button><button class="btn btn-primary" id="receberCompra">Receber e atualizar estoque</button></div>':''}`;byId('backCompras').onclick=compras;if(edit){byId('addCompraItem').onclick=async()=>{try{await api('/avancado/compras/'+id+'/itens',{method:'POST',body:JSON.stringify({produto_id:byId('compraProduto').value,quantidade:byId('compraQtd').value,custo_unitario:byId('compraCusto').value})});await compraDetalhe(id)}catch(e){alert(e.message)}};byId('receberCompra').onclick=async()=>{if(!confirm('Confirmar recebimento e somar ao estoque?'))return;try{await api('/avancado/compras/'+id+'/receber',{method:'POST',body:'{}'});await compraDetalhe(id)}catch(e){alert(e.message)}};byId('cancelCompra').onclick=async()=>{try{await api('/avancado/compras/'+id+'/cancelar',{method:'POST',body:'{}'});await compras()}catch(e){alert(e.message)}}}initResponsiveTables();
}
async function insumosServicos(){
  const [{ss},produtos]=await Promise.all([base(),api('/operacao/produtos')]);contentEl.innerHTML=`<div class="section-head"><div><h2>Insumos por serviço</h2><p>Ex.: um corte pode consumir 2 ml de produto. Ao fechar a venda, o EliteFlow baixa automaticamente do estoque.</p></div><button class="btn btn-secondary" id="backEstoque">← Produtos</button></div><div class="field"><label>Serviço</label><select id="insumoServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div id="insumoEditor"></div>`;byId('backEstoque').onclick=estoque;const load=async()=>{const sid=byId('insumoServico').value,rows=await api('/avancado/servicos/'+sid+'/insumos');byId('insumoEditor').innerHTML=`<h3>Consumo configurado</h3>${rows.map(x=>`<div class="inline-row"><strong>${esc(x.produto)}</strong><span>${Number(x.quantidade)} ${esc(x.unidade||'un')}</span></div>`).join('')||'<p class="muted">Nenhum insumo configurado.</p>'}<div class="form-grid"><div class="field"><label>Produto</label><select id="insumoProduto">${produtos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} (${esc(x.unidade||'un')})</option>`).join('')}</select></div><div class="field"><label>Quantidade por atendimento</label><input id="insumoQtd" type="number" min="0.001" step="0.001" value="1"></div></div><div class="actions"><button class="btn btn-secondary" id="insumoLimpar">Limpar</button><button class="btn btn-primary" id="insumoSalvar">Adicionar / salvar</button></div>`;byId('insumoSalvar').onclick=async()=>{const produto=Number(byId('insumoProduto').value),q=Number(byId('insumoQtd').value),map=new Map(rows.map(x=>[Number(x.produto_id),{produto_id:Number(x.produto_id),quantidade:Number(x.quantidade)}]));map.set(produto,{produto_id:produto,quantidade:q});try{await api('/avancado/servicos/'+sid+'/insumos',{method:'PUT',body:JSON.stringify({itens:[...map.values()]})});await load()}catch(e){alert(e.message)}};byId('insumoLimpar').onclick=async()=>{if(!confirm('Remover todos os insumos deste serviço?'))return;await api('/avancado/servicos/'+sid+'/insumos',{method:'PUT',body:JSON.stringify({itens:[]})});await load()}};byId('insumoServico').onchange=load;await load();
}

// 3.0 — fidelidade com venda de pacotes e extrato de pontos
async function fidelidade(){
 const [{cs,ss},cfg,pacotes]=await Promise.all([base(),api('/operacao/fidelidade'),api('/operacao/pacotes')]);contentEl.innerHTML=`<h2>Fidelidade e pacotes</h2><div class="form-grid"><label class="check"><input id="fidAtivo" type="checkbox" ${cfg.ativo?'checked':''}> Ativar pontos</label><div class="field"><label>Pontos por R$ 1</label><input id="fidPontosReal" type="number" value="${cfg.pontos_por_real||1}"></div><div class="field"><label>Pontos recompensa</label><input id="fidRecompensaPontos" type="number" value="${cfg.pontos_recompensa||500}"></div><div class="field"><label>Recompensa</label><input id="fidRecompensaTexto" value="${esc(cfg.recompensa_texto||'Benefício da barbearia')}"></div></div><button class="btn btn-primary" id="salvarFidelidade">Salvar fidelidade</button><hr><div class="two-columns"><div><h3>Criar pacote</h3><div class="field"><label>Nome</label><input id="pacNome"></div><div class="form-grid"><div class="field"><label>Preço</label><input id="pacPreco" type="number" min="0" step="0.01"></div><div class="field"><label>Validade dias</label><input id="pacValidade" type="number" min="1" value="90"></div><div class="field"><label>Serviço</label><select id="pacServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Quantidade</label><input id="pacQtd" type="number" min="1" value="3"></div></div><button class="btn btn-secondary" id="novoPacote">Criar pacote</button></div><div><h3>Vender pacote</h3><div class="field"><label>Cliente</label><select id="pacCliente">${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Pacote</label><select id="pacPacote">${pacotes.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco)}</option>`).join('')}</select></div><button class="btn btn-secondary" id="venderPacote">Vender / ativar</button><button class="btn btn-secondary" id="verPontos">Ver extrato do cliente</button></div></div><h3>Pacotes cadastrados</h3><div class="cards compact-cards">${pacotes.map(x=>`<div class="card"><strong>${esc(x.nome)}</strong><p>${money(x.preco)} · ${x.validade_dias||90} dias</p></div>`).join('')||'<p class="muted">Nenhum pacote.</p>'}</div><div id="fidExtrato"></div>`;byId('salvarFidelidade').onclick=async()=>{try{await api('/operacao/fidelidade',{method:'PUT',body:JSON.stringify({ativo:byId('fidAtivo').checked,pontos_por_real:byId('fidPontosReal').value,pontos_recompensa:byId('fidRecompensaPontos').value,recompensa_texto:byId('fidRecompensaTexto').value})});alert('Fidelidade salva.')}catch(e){alert(e.message)}};byId('novoPacote').onclick=async()=>{try{const p=await api('/operacao/pacotes',{method:'POST',body:JSON.stringify({nome:byId('pacNome').value,preco:byId('pacPreco').value,descricao:`${byId('pacQtd').value} serviço(s)`,validade_dias:byId('pacValidade').value})});await api('/avancado/pacotes/'+p.id+'/vender',{method:'POST',body:JSON.stringify({cliente_id:byId('pacCliente').value,servico_id:byId('pacServico').value,quantidade:byId('pacQtd').value})});alert('Pacote criado e vendido ao cliente selecionado.');await fidelidade()}catch(e){alert(e.message)}};byId('venderPacote').onclick=async()=>{try{await api('/avancado/pacotes/'+byId('pacPacote').value+'/vender',{method:'POST',body:JSON.stringify({cliente_id:byId('pacCliente').value,servico_id:byId('pacServico').value,quantidade:byId('pacQtd').value})});alert('Pacote ativado para o cliente.')}catch(e){alert(e.message)}};byId('verPontos').onclick=async()=>{try{const r=await api('/avancado/fidelidade/cliente/'+byId('pacCliente').value);byId('fidExtrato').innerHTML=`<h3>Extrato</h3><p><strong>${r.saldo.pontos||0} pontos</strong></p>${r.movimentos.map(x=>`<div class="inline-row"><span>${esc(x.descricao||x.tipo)}</span><strong>${x.pontos>0?'+':''}${x.pontos}</strong></div>`).join('')||'<p class="muted">Sem movimentos.</p>'}`}catch(e){alert(e.message)}};
}

// 3.0 — clube com cobranças e consumo mensal
async function clube(){
  const [{cs,ss},planos,assinaturas,cobrancas]=await Promise.all([base(),api('/avancado/clube/planos'),api('/avancado/clube/assinaturas'),api('/avancado/clube/cobrancas')]);
  const mrr=assinaturas.filter(x=>x.status==='ativa').reduce((a,x)=>a+Number(x.preco_mensal||0),0),pend=cobrancas.filter(x=>['pendente','vencida'].includes(x.status)).reduce((a,x)=>a+Number(x.valor||0),0);
  contentEl.innerHTML=`<div class="section-head"><div><h2>Clube de Assinaturas</h2><p>Planos, franquias mensais, consumo, cobranças e inadimplência.</p></div><button class="btn btn-secondary" id="processarClube">Processar cobranças</button></div><div class="cards compact-cards"><div class="card"><div class="label">Assinantes ativos</div><div class="value">${assinaturas.filter(x=>x.status==='ativa').length}</div></div><div class="card"><div class="label">MRR</div><div class="value">${money(mrr)}</div></div><div class="card"><div class="label">A receber</div><div class="value">${money(pend)}</div></div><div class="card"><div class="label">Inadimplentes</div><div class="value">${assinaturas.filter(x=>x.status==='inadimplente').length}</div></div></div><div class="two-columns"><div><h3>Novo plano</h3><div class="field"><label>Nome</label><input id="clubeNome" placeholder="Corte Mensal"></div><div class="form-grid"><div class="field"><label>Preço</label><input id="clubePreco" type="number" step="0.01"></div><div class="field"><label>Dia cobrança</label><input id="clubeDia" type="number" min="1" max="28" value="10"></div><div class="field"><label>Serviço</label><select id="clubeServico">${ss.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Qtd./mês</label><input id="clubeQtd" type="number" min="1" value="1"></div></div><button class="btn btn-primary" id="criarClubePlano">Criar plano</button></div><div><h3>Novo assinante</h3><div class="field"><label>Cliente</label><select id="clubeCliente">${cs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Plano</label><select id="clubePlano">${planos.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)} — ${money(x.preco_mensal)}</option>`).join('')}</select></div><button class="btn btn-secondary" id="assinarClube">Adicionar assinante</button></div></div><h3>Assinaturas</h3><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Plano</th><th>Status</th><th>Próxima</th><th>Uso mês</th><th>Ação</th></tr></thead><tbody>${assinaturas.map(x=>`<tr><td>${esc(x.cliente)}</td><td>${esc(x.plano)}</td><td>${esc(x.status)}</td><td>${x.proxima_cobranca?dateBR(x.proxima_cobranca):'-'}</td><td>${x.consumos_mes}</td><td><button class="btn btn-secondary" data-clube-use="${x.id}" data-plano="${x.plano_id}">Registrar uso</button> <select data-clube-status="${x.id}"><option ${x.status==='ativa'?'selected':''}>ativa</option><option ${x.status==='pausada'?'selected':''}>pausada</option><option ${x.status==='inadimplente'?'selected':''}>inadimplente</option><option ${x.status==='cancelada'?'selected':''}>cancelada</option></select></td></tr>`).join('')||'<tr><td colspan="6">Sem assinantes.</td></tr>'}</tbody></table></div><h3>Cobranças</h3><div class="table-wrap"><table class="table"><thead><tr><th>Vencimento</th><th>Cliente</th><th>Plano</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${cobrancas.slice(0,100).map(x=>`<tr><td>${dateBR(x.vencimento)}</td><td>${esc(x.cliente)}</td><td>${esc(x.plano)}</td><td>${money(x.valor)}</td><td>${esc(x.status)}</td><td>${x.status!=='paga'&&x.status!=='cancelada'?`<button class="btn btn-secondary" data-clube-pay="${x.id}">Marcar paga</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6">Sem cobranças.</td></tr>'}</tbody></table></div>`;
  byId('criarClubePlano').onclick=async()=>{try{await api('/avancado/clube/planos',{method:'POST',body:JSON.stringify({nome:byId('clubeNome').value,preco_mensal:byId('clubePreco').value,dia_cobranca:byId('clubeDia').value,servicos:[{servico_id:byId('clubeServico').value,quantidade:byId('clubeQtd').value}]})});await clube()}catch(e){alert(e.message)}};byId('assinarClube').onclick=async()=>{try{await api('/avancado/clube/assinaturas',{method:'POST',body:JSON.stringify({cliente_id:byId('clubeCliente').value,plano_id:byId('clubePlano').value})});await clube()}catch(e){alert(e.message)}};byId('processarClube').onclick=async()=>{try{await api('/avancado/clube/cobrancas/processar',{method:'POST',body:'{}'});await clube()}catch(e){alert(e.message)}};contentEl.querySelectorAll('[data-clube-status]').forEach(el=>el.onchange=async()=>{try{await api('/avancado/clube/assinaturas/'+el.dataset.clubeStatus,{method:'PATCH',body:JSON.stringify({status:el.value})})}catch(e){alert(e.message)}});contentEl.querySelectorAll('[data-clube-pay]').forEach(b=>b.onclick=async()=>{try{await api('/avancado/clube/cobrancas/'+b.dataset.clubePay+'/pagar',{method:'POST',body:JSON.stringify({forma_pagamento:'manual'})});await clube()}catch(e){alert(e.message)}});contentEl.querySelectorAll('[data-clube-use]').forEach(b=>b.onclick=async()=>{const plano=planos.find(p=>String(p.id)===String(b.dataset.plano)),serv=plano?.servicos?.[0];if(!serv)return alert('Este plano não tem serviço configurado.');try{await api('/avancado/clube/assinaturas/'+b.dataset.clubeUse+'/consumir',{method:'POST',body:JSON.stringify({servico_id:serv.servico_id,quantidade:1})});alert('Uso registrado.');await clube()}catch(e){alert(e.message)}});initResponsiveTables();
}
