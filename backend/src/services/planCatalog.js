const CATALOGO=Object.freeze({
  starter:Object.freeze({
    id:'starter',nome:'Starter',preco_mensal:59.90,preco_anual:599,preco_anual_referencia:599,limite_profissionais:2,badge:'ESSENCIAL',
    descricao:'Para barbeiro autônomo ou barbearia pequena.',
    destaques:['Agenda completa','Clientes e serviços','Página pública de agendamento','Até 2 profissionais'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples']
  }),
  pro:Object.freeze({
    id:'pro',nome:'Pro',preco_mensal:109.90,preco_anual:1099,preco_anual_referencia:1099,limite_profissionais:5,badge:'MAIS ESCOLHIDO',
    descricao:'Gestão completa para barbearias com equipe e vendas.',
    destaques:['Tudo do Starter','Equipe e permissões','Financeiro e gráficos','Produtos, estoque e PDV','Comissões, fila e avaliações','Mercado Pago','Até 5 profissionais','IA no WhatsApp elegível como adicional futuro'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples','equipe','financeiro_basico','financeiro_graficos','pagamentos_online','pdv_estoque','comissoes','fila_espera','avaliacoes','ia_addon_elegivel']
  }),
  premium:Object.freeze({
    id:'premium',nome:'Premium',preco_mensal:189.90,preco_anual:1899,preco_anual_referencia:1899,limite_profissionais:null,badge:'IA + AUTOMAÇÃO',
    descricao:'Operação avançada, loja, automações e base pronta para atendimento com IA.',
    destaques:['Tudo do Pro','Profissionais ilimitados','Automações e WhatsApp','Página pública personalizada','CRM e fidelidade','Marketing com campanhas, cupons e indicações','Relatórios avançados e exportação','IA no WhatsApp incluída na próxima etapa','Franquia planejada: 500 atendimentos de IA/mês'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples','equipe','financeiro_basico','financeiro_graficos','pagamentos_online','pdv_estoque','comissoes','fila_espera','avaliacoes','automacoes','whatsapp','pagina_publica_completa','personalizacao_publica','crm_avancado','fidelidade','relatorios_avancados','exportacao_dados','marketing','ia_config','ia_whatsapp']
  })
});
const MATRIZ=Object.fromEntries(Object.entries(CATALOGO).map(([k,v])=>[k,new Set(v.recursos)]));
const ORDEM={starter:1,pro:2,premium:3};
function planoValido(p){return MATRIZ[p]?p:'starter'}
function trialAtivo(a){if(!a||a.status!=='trial'||!a.fim_trial)return false;return new Date(String(a.fim_trial).slice(0,10)+'T23:59:59')>=new Date()}
function planoEfetivo(a){if(trialAtivo(a))return 'premium';return planoValido(a?.plano)}
function recursosDoPlano(plano){return [...(MATRIZ[planoValido(plano)]||MATRIZ.starter)]}
function temRecursoAssinatura(a,recurso){return MATRIZ[planoEfetivo(a)]?.has(recurso)||false}
function diasRestantesTrial(a){if(!trialAtivo(a))return 0;const hoje=new Date();hoje.setHours(0,0,0,0);const fim=new Date(String(a.fim_trial).slice(0,10)+'T00:00:00');return Math.max(0,Math.ceil((fim-hoje)/86400000));}
function limiteProfissionais(plano){return CATALOGO[planoValido(plano)].limite_profissionais}
function planoMinimoParaRecurso(recurso){return Object.keys(ORDEM).sort((a,b)=>ORDEM[a]-ORDEM[b]).find(p=>MATRIZ[p].has(recurso))||'premium'}
function catalogoPublico(){return Object.values(CATALOGO).map(({recursos,...p})=>({...p,recursos:[...recursos],economia_anual:Number((p.preco_mensal*12-p.preco_anual).toFixed(2)),equivalente_mensal_anual:Number((p.preco_anual/12).toFixed(2))}))}
module.exports={CATALOGO,MATRIZ,ORDEM,planoValido,trialAtivo,planoEfetivo,recursosDoPlano,temRecursoAssinatura,diasRestantesTrial,limiteProfissionais,planoMinimoParaRecurso,catalogoPublico};
