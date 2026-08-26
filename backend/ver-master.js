require('dotenv').config();

const pool = require('./src/config/db');

(async () => {
    const resultado = await pool.query(`
        SELECT
            u.id,
            u.email,
            u.ativo,
            u.mfa_enabled,
            u.barbearia_id,
            b.slug,
            b.is_system
        FROM usuarios u
        JOIN barbearias b
          ON b.id = u.barbearia_id
        WHERE u.papel = 'super_admin'
        ORDER BY u.id
    `);

    console.table(resultado.rows);

    await pool.end();
})().catch(async erro => {
    console.error(erro);
    await pool.end();
    process.exit(1);
});