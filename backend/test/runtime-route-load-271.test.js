const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

test('aplicação carrega todas as rotas sem ReferenceError em runtime',()=>{
  const backend=path.resolve(__dirname,'..');
  const out=execFileSync(process.execPath,['-e',"require('./src/app'); process.stdout.write('APP_LOAD_OK'); process.exit(0)"],{
    cwd:backend,
    env:{...process.env,NODE_ENV:'test'},
    encoding:'utf8',
    timeout:10000
  });
  assert.equal(out,'APP_LOAD_OK');
});
