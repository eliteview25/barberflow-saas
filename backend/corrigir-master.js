require('dotenv').config();

const pool = require('./src/config/db');

(async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultado = await client.query(`
            UPDATE usuarios
            SET ativo = false
            WHERE id = 5
              AND papel = 'super_admin'
              AND barbearia_id = (
                  SELECT id
                  FROM barbearias
                  WHERE is_system = true
                  LIMIT 1
              )
            RETURNING id, email, ativo
        `);

        if (resultado.rowCount !== 1) {
            throw new Error('Supermaster duplicado não encontrado como esperado.');
        }

        await client.query('COMMIT');

        console.log('✅ Supermaster duplicado desativado:');
        console.table(resultado.rows);
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('❌ Erro:', erro.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();