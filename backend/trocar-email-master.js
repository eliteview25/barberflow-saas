require('dotenv').config();

const pool = require('./src/config/db');

(async () => {
    const novoEmail = String(process.env.NEW_MASTER_EMAIL || '')
        .trim()
        .toLowerCase();

    if (!novoEmail || !novoEmail.includes('@')) {
        throw new Error('Defina NEW_MASTER_EMAIL no Render antes de executar.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const master = await client.query(`
            SELECT u.id, u.email, u.barbearia_id
            FROM usuarios u
            JOIN barbearias b ON b.id = u.barbearia_id
            WHERE u.papel = 'super_admin'
              AND u.ativo = true
              AND b.is_system = true
            FOR UPDATE
        `);

        if (master.rowCount !== 1) {
            throw new Error(
                `Esperado 1 Supermaster ativo, encontrados ${master.rowCount}.`
            );
        }

        const duplicado = await client.query(`
            SELECT id
            FROM usuarios
            WHERE LOWER(email) = LOWER($1)
              AND id <> $2
            LIMIT 1
        `, [novoEmail, master.rows[0].id]);

        if (duplicado.rowCount) {
            throw new Error('Esse e-mail já pertence a outro usuário.');
        }

        const atualizado = await client.query(`
            UPDATE usuarios
            SET email = $1,
                atualizado_em = NOW(),
                token_version = COALESCE(token_version, 0) + 1
            WHERE id = $2
            RETURNING id, email, ativo, mfa_enabled
        `, [novoEmail, master.rows[0].id]);

        await client.query(`
            UPDATE password_resets
            SET usado = true
            WHERE usuario_id = $1
              AND usado = false
        `, [master.rows[0].id]);

        await client.query('COMMIT');

        console.log('✅ E-mail do Supermaster atualizado.');
        console.table(atualizado.rows);
        console.log('✅ Sessões antigas e resets anteriores foram invalidados.');
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('❌', erro.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();