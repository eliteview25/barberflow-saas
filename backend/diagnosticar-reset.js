require('dotenv').config();

const pool = require('./src/config/db');

(async () => {
    const r = await pool.query(`
        SELECT
            pr.id,
            u.email,
            pr.usado,
            pr.criado_em,
            pr.expira_em,
            NOW() AS agora,
            EXTRACT(EPOCH FROM (pr.expira_em - NOW()))::int AS segundos_restantes
        FROM password_resets pr
        JOIN usuarios u
          ON u.id = pr.usuario_id
        WHERE u.papel = 'super_admin'
          AND u.ativo = true
        ORDER BY pr.id DESC
        LIMIT 5
    `);

    console.table(r.rows);

    await pool.end();
})().catch(async erro => {
    console.error(erro);
    await pool.end();
    process.exit(1);
});