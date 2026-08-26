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

async function estoque(){
  const produtos=await api('/operacao/produtos');
  contentEl.innerHTML=`
    <div class="section-head"><div><h2>Produtos e estoque</h2><p>Cadastre itens para venda e acompanhe níveis de estoque.</p></div><button class="btn btn-primary" id="novoProduto">+ Produto</button></div>
    <div class="cards compact-cards">
      <div class="card"><div class="label">Produtos ativos</div><div class="value">${produtos.filter(p=>p.ativo).length}</div></div>
      <div class="card"><div class="label">Estoque baixo</div><div class="value">${produtos.filter(p=>Number(p.estoque)<=Number(p.estoque_minimo)).length}</div></div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Preço</th><th>Custo</th><th>Estoque</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>
      ${produtos.map(p=>`<tr><td>${esc(p.nome)}</td><td>${esc(p.sku||'-')}</td><td>${money(p.preco)}</td><td>${money(p.custo)}</td><td>${p.estoque}</td><td>${p.estoque_minimo}</td><td>${Number(p.estoque)<=Number(p.estoque_minimo)?'⚠️ Baixo':'✅ OK'}</td></tr>`).join('')||'<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>'}
    </tbody></table></div>`;

  byId('novoProduto').addEventListener('click',async()=>{
    const nome=prompt('Nome do produto:'); if(!nome)return;
    const sku=prompt('SKU (opcional):','')||'';
    const preco=prompt('Preço de venda:','0');
    const custo=prompt('Custo:','0');
    const qtd=prompt('Estoque inicial:','0');
    const minimo=prompt('Estoque mínimo:','5');
    try{
      await api('/operacao/produtos',{method:'POST',body:JSON.stringify({nome,sku,preco,custo,estoque:qtd,estoque_minimo:minimo})});
      await estoque();
    }catch(e){ alert(e.message); }
  });
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
  a.href=URL.createObjectURL(blob); a.download=`barberflow-${tipo}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
