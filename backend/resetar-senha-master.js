require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');
const { strongPassword } = require('./src/utils/security');

(async () => {
    const novaSenha = String(process.env.NEW_MASTER_PASSWORD || '');

    if (!strongPassword(novaSenha)) {
        throw new Error(
            'NEW_MASTER_PASSWORD deve ter 12+ caracteres, maiúscula, minúscula, número e símbolo.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const master = await client.query(`
            SELECT u.id, u.email
            FROM usuarios u
            JOIN barbearias b
              ON b.id = u.barbearia_id
            WHERE u.papel = 'super_admin'
              AND u.ativo = true
              AND b.is_system = true
            FOR UPDATE
        `);

        if (master.rowCount !== 1) {
            throw new Error(
                \`Esperado exatamente 1 Supermaster ativo; encontrados \${master.rowCount}.\`
            );
        }

        const senhaHash = await bcrypt.hash(novaSenha, 12);

        await client.query(`
            UPDATE usuarios
            SET senha_hash = $1,
                token_version = COALESCE(token_version, 0) + 1
            WHERE id = $2
        `, [senhaHash, master.rows[0].id]);

        await client.query(`
            UPDATE password_resets
            SET usado = true
            WHERE usuario_id = $1
              AND usado = false
        `, [master.rows[0].id]);

        await client.query('COMMIT');

        console.log('✅ Senha do Supermaster redefinida com segurança.');
        console.log('E-mail:', master.rows[0].email);
        console.log('✅ Sessões e links de recuperação anteriores foram invalidados.');
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('❌', erro.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();