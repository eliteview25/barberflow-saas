const TOOL_MAP=Object.freeze({
  consultar_horarios:'consultar_horarios',
  criar_agendamento:'criar_agendamento',
  reagendar:'reagendar_agendamento',
  cancelar:'cancelar_agendamento',
  informar_precos:'listar_servicos_e_precos',
  enviar_link_pagamento:'criar_link_pagamento'
});
function allowedAiTools(config={}){return Object.entries(TOOL_MAP).filter(([flag])=>config[flag]===true).map(([,tool])=>tool)}
module.exports={TOOL_MAP,allowedAiTools};
