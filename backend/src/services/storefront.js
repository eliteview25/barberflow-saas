const pool=require('../config/db');

async function ensureStorefrontSchema(db=pool){
  const cols=[
    ['loja_ativa','BOOLEAN NOT NULL DEFAULT false'],['loja_titulo','VARCHAR(160)'],['loja_descricao','TEXT'],['loja_logo_url','TEXT'],['loja_banner_url','TEXT']
  ];
  for(const [c,t] of cols)await db.query(`ALTER TABLE barbearias ADD COLUMN IF NOT EXISTS ${c} ${t}`);
  for(const [c,t] of [['mostrar_na_loja','BOOLEAN NOT NULL DEFAULT false'],['destaque_pagina_publica','BOOLEAN NOT NULL DEFAULT false'],['descricao_publica','TEXT']])await db.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ${c} ${t}`);
  await db.query(`CREATE INDEX IF NOT EXISTS ix_produtos_loja ON produtos(barbearia_id,mostrar_na_loja,ativo) WHERE mostrar_na_loja=true`);
}

module.exports={ensureStorefrontSchema};
