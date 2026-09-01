# Plano de Resposta a Incidentes com Dados Pessoais

Base operacional para o EliteFlow. Revisão: 01/09/2026.

## 1. Acionamento
Considere incidente confirmado quando houver violação de confidencialidade, integridade ou disponibilidade envolvendo dados pessoais. Uma vulnerabilidade sem exploração não é, por si só, incidente de dados.

## 2. Primeiras ações
1. Conter o evento sem destruir evidências.
2. Registrar data/hora de detecção e de conhecimento de que dados pessoais foram afetados.
3. Identificar tenants, sistemas, dados, titulares e terceiros afetados.
4. Revogar tokens/chaves comprometidos e preservar logs.
5. Avaliar risco ou dano relevante.
6. Se o EliteFlow atuar como operador, avisar o controlador afetado sem demora indevida.

## 3. Comunicação
Quando o EliteFlow for controlador e o incidente puder causar risco ou dano relevante, a Resolução CD/ANPD nº 15/2024 prevê comunicação à ANPD e aos titulares no prazo de 3 dias úteis, ressalvada legislação específica. A comunicação pode ser preliminar e depois complementada quando informações ainda não estiverem disponíveis.

## 4. Conteúdo mínimo a levantar
- natureza e categoria dos dados afetados;
- quantidade estimada de titulares e, quando aplicável, crianças/adolescentes/idosos;
- medidas de segurança existentes antes/depois;
- riscos e impactos;
- data do incidente e do conhecimento;
- medidas de contenção e mitigação;
- contato do encarregado/representante;
- motivos de eventual atraso.

## 5. Registro
Manter registro de incidentes com dados pessoais por pelo menos 5 anos, inclusive quando a avaliação concluir que não era comunicável. Registrar decisão, critérios, evidências e ações corretivas.

## 6. Pós-incidente
- análise de causa raiz;
- correção técnica e rotação de segredos;
- revisão de permissões, logs e contratos;
- comunicação adicional aos clientes quando necessária;
- atualização de RIPD/testes de risco;
- lições aprendidas e treinamento.
