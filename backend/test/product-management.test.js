const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const front=fs.readFileSync(path.resolve(__dirname,'../../frontend/js/gestao.js'),'utf8');
const route=fs.readFileSync(path.resolve(__dirname,'../src/routes/operacao.js'),'utf8');

test('gestão de produtos oferece edição e ajuste de estoque',()=>{
  assert.match(front,/data-prod-edit/);
  assert.match(front,/data-prod-stock/);
  assert.match(front,/openProductModal/);
  assert.match(front,/openStockModal/);
  assert.match(front,/method:editing\?'PUT':'POST'/);
});

test('gestão de produtos oferece busca, filtros e ativação',()=>{
  assert.match(front,/produtoBusca/);
  assert.match(front,/produtoStatus/);
  assert.match(front,/produtoNivel/);
  assert.match(front,/data-prod-toggle/);
});

test('backend permite editar produto somente dentro da barbearia',()=>{
  assert.match(route,/router\.put\('\/produtos\/:id'/);
  assert.match(route,/WHERE id=\$9 AND barbearia_id=\$10 RETURNING \*/);
});

test('produto permite foto opcional e exclusão controlada',()=>{
  assert.match(front,/produtoImagemUrl/);
  assert.match(front,/produtoImagemFile/);
  assert.match(front,/\/api\/uploads\/produto-imagem/);
  assert.match(front,/data-prod-delete/);
  assert.match(route,/router\.delete\('\/produtos\/:id'/);
  assert.match(route,/DELETE FROM produtos WHERE id=\$1 AND barbearia_id=\$2/);
});
