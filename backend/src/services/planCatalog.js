const CATALOGO=Object.freeze({
  starter:Object.freeze({
    id:'starter',nome:'Starter',preco_mensal:69.90,preco_anual:699,preco_anual_referencia:699,limite_profissionais:2,badge:'ESSENCIAL',
    descricao:'Operação completa para barbeiro autônomo ou barbearia pequena.',
    destaques:['Agenda e página pública','Clientes e serviços','Financeiro e gráficos','Produtos, estoque e PDV','Comandas integradas','Comissões','Até 2 profissionais'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples','financeiro_basico','financeiro_graficos','pdv_estoque','comandas','comissoes']
  }),
  pro:Object.freeze({
    id:'pro',nome:'Pro',preco_mensal:119.90,preco_anual:1199,preco_anual_referencia:1199,limite_profissionais:5,badge:'MAIS ESCOLHIDO',
    descricao:'Crescimento, relacionamento e automação para barbearias com equipe.',
    destaques:['Tudo do Starter','Equipe e permissões','Pagamentos online','WhatsApp e automações','CRM avançado','Fila de espera e avaliações','Fidelidade e pacotes','Clube de assinaturas','Marketing inteligente','Relatórios avançados','Até 5 profissionais'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples','financeiro_basico','financeiro_graficos','pdv_estoque','comandas','comissoes','equipe','pagamentos_online','fila_espera','avaliacoes','automacoes','whatsapp','crm_avancado','fidelidade','relatorios_avancados','marketing','marketing_inteligente','clube_assinaturas']
  }),
  premium:Object.freeze({
    id:'premium',nome:'Premium',preco_mensal:199.90,preco_anual:1999,preco_anual_referencia:1999,limite_profissionais:10,badge:'IA + INTELIGÊNCIA',
    descricao:'Automação avançada, IA, inteligência gerencial e recursos fiscais.',
    destaques:['Tudo do Pro','Até 10 profissionais','Página pública personalizada','BI gerencial avançado','Exportação de dados','NFS-e preparada para integração','IA no WhatsApp — até 500 atendimentos/mês quando ativada'],
    recursos:['agenda','clientes','barbeiros','servicos','pagina_publica_simples','financeiro_basico','financeiro_graficos','pdv_estoque','comandas','comissoes','equipe','pagamentos_online','fila_espera','avaliacoes','automacoes','whatsapp','crm_avancado','fidelidade','relatorios_avancados','marketing','marketing_inteligente','clube_assinaturas','pagina_publica_completa','personalizacao_publica','exportacao_dados','bi_avancado','fiscal_nfse','ia_config','ia_whatsapp']
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
