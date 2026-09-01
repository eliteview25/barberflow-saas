const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
test('migração só libera trial_pendente depois da verificação',()=>{const m=read('backend/migrar-banco.js');assert.match(m,/a\.status='trial_pendente'/);assert.match(m,/email_verificado,false\)=true/);assert.match(m,/ALTER COLUMN email_verificado SET DEFAULT false/);assert.doesNotMatch(m,/SET email_verificado=true WHERE COALESCE\(is_system,false\)=false/)});
test('páginas protegidas não ficam invisíveis quando uma API falha',()=>{const c=read('frontend/js/common.js');assert.match(c,/function requireAuth[\s\S]*mostrarPaginaProtegida\(\)/)});
test('assets do painel revalidam após deploy em vez de cachear por uma hora',()=>{const a=read('backend/src/app.js');assert.match(a,/express\.static\(frontend,\{maxAge:0,etag:true\}\)/)});
