const express = require('express');
const { externalSignal } = require('../utils/http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

const { autenticar } = require('../middlewares/auth');
const { contextoPlano } = require('../services/planos');
const { encrypt, decrypt } = require('../services/secrets');

const {
    sessionCookie,
    csrfCookie,
    clearSession,
    randomToken,
    sha256,
    strongPassword,
    validEmail,
    verifyTurnstile,
    normalizePhone
} = require('../utils/security');

const {
    generateSecret,
    verifyTotp,
    otpauthUri
} = require('../utils/totp');

const { cleanText } = require('../utils/validation');

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function slugify(texto) {
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

router.get('/security-config', (req, res) => {
    res.json({
        turnstile_site_key:
            process.env.TURNSTILE_SITE_KEY || null
    });
});

function signSession(usuario) {
    return jwt.sign(
        {
            purpose: 'session',
            id: usuario.id,
            barbearia_id: usuario.barbearia_id,
            papel: usuario.papel,
            nome: usuario.nome,
            sv: Number(usuario.token_version || 0)
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '12h',
            algorithm: 'HS256'
        }
    );
}

function setSession(res, usuario) {
    const token = signSession(usuario);
    const csrf = randomToken(24);

    sessionCookie(res, token);
    csrfCookie(res, csrf);

    return csrf;
}

/* =========================================================
   VERIFICAÇÃO DE E-MAIL
========================================================= */

function createEmailVerificationToken(usuario) {
    return jwt.sign(
        {
            purpose: 'email_verify',
            id: Number(usuario.id),
            barbearia_id: Number(usuario.barbearia_id),
            sv: Number(usuario.token_version || 0)
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '24h',
            algorithm: 'HS256'
        }
    );
}

async function sendVerification(email, token) {
    const base = (
        process.env.APP_URL ||
        'http://localhost:3001'
    ).replace(/\/$/, '');

    const link =
        `${base}/verificar-email.html?token=${encodeURIComponent(token)}`;

    if (
        process.env.RESEND_API_KEY &&
        process.env.EMAIL_FROM
    ) {
        const resposta = await fetch(
            'https://api.resend.com/emails',
            {
                method: 'POST',

                headers: {
                    Authorization:
                        `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    from: process.env.EMAIL_FROM,
                    to: [email],
                    subject:
                        'Confirme seu e-mail no BarberFlow',
                    html: `
                        <p>Confirme seu e-mail:</p>
                        <p>
                            <a href="${link}">
                                Confirmar e-mail
                            </a>
                        </p>
                        <p>
                            Este link expira em 24 horas.
                        </p>
                    `
                }),

                signal: externalSignal()
            }
        );

        if (!resposta.ok) {
            const detalhe = await resposta
                .text()
                .catch(() => '');

            throw new Error(
                `Falha ao enviar verificação (${resposta.status}) ${detalhe.slice(0, 300)}`
            );
        }

        return;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'Serviço de e-mail não configurado'
        );
    }

    console.log(
        'Link de verificação (DEV):',
        link
    );
}

/* =========================================================
   REGISTRAR BARBEARIA
========================================================= */

router.post('/registrar', async (req, res) => {

    if (
        process.env.ALLOW_PUBLIC_REGISTRATION === 'false'
    ) {
        return res.status(403).json({
            erro:
                'Cadastro público temporariamente desativado'
        });
    }

    const barbearia = cleanText(
        req.body?.barbearia,
        120,
        { required: true }
    );

    const nome = cleanText(
        req.body?.nome,
        120,
        { required: true }
    );

    const email = String(
        req.body?.email || ''
    )
        .trim()
        .toLowerCase();

    const senha = String(
        req.body?.senha || ''
    );

    const telefone =
        normalizePhone(req.body?.telefone) ||
        null;

    const turnstileToken =
        req.body?.turnstile_token;

    if (
        !barbearia ||
        !nome ||
        !email ||
        !senha
    ) {
        return res.status(400).json({
            erro:
                'Barbearia, nome, e-mail e senha são obrigatórios'
        });
    }

    if (
        !validEmail(email) ||
        email.length > 160
    ) {
        return res.status(400).json({
            erro: 'E-mail inválido'
        });
    }

    if (
        req.body?.telefone &&
        (!telefone || telefone.length < 10)
    ) {
        return res.status(400).json({
            erro: 'Telefone inválido'
        });
    }

    if (!strongPassword(senha)) {
        return res.status(400).json({
            erro:
                'Use senha com 12+ caracteres, maiúscula, minúscula, número e símbolo'
        });
    }

    const turnstileOk =
        await verifyTurnstile(
            turnstileToken,
            req.ip,
            {
                action: 'signup'
            }
        );

    if (!turnstileOk) {
        return res.status(400).json({
            erro:
                'Verificação anti-robô inválida'
        });
    }

    const c = await pool.connect();

    try {

        await c.query('BEGIN');

        const emailExiste = await c.query(
            `
            SELECT 1
            FROM usuarios
            WHERE LOWER(email) = LOWER($1)
            `,
            [email]
        );

        if (emailExiste.rowCount) {

            await c.query('ROLLBACK');

            return res.status(409).json({
                erro: 'E-mail já cadastrado'
            });
        }

        let base =
            slugify(barbearia)
                .slice(0, 100) ||
            'barbearia';

        await c.query(
            `
            SELECT pg_advisory_xact_lock(
                hashtext($1)
            )
            `,
            [`signup-slug:${base}`]
        );

        let slug = base;
        let i = 1;

        while (
            (
                await c.query(
                    `
                    SELECT 1
                    FROM barbearias
                    WHERE slug = $1
                    `,
                    [slug]
                )
            ).rowCount
        ) {
            slug =
                `${base.slice(0, 94)}-${++i}`;
        }

        const tenant = await c.query(
            `
            INSERT INTO barbearias(
                nome,
                slug,
                telefone,
                ativo,
                email_verificado,
                is_system
            )
            VALUES(
                $1,
                $2,
                $3,
                true,
                false,
                false
            )
            RETURNING *
            `,
            [
                barbearia,
                slug,
                telefone
            ]
        );

        const senhaHash =
            await bcrypt.hash(
                senha,
                12
            );

        const usuario = await c.query(
            `
            INSERT INTO usuarios(
                barbearia_id,
                nome,
                email,
                senha_hash,
                papel,
                ativo,
                token_version,
                telefone
            )
            VALUES(
                $1,
                $2,
                $3,
                $4,
                'dono',
                true,
                0,
                $5
            )
            RETURNING
                id,
                barbearia_id,
                nome,
                email,
                papel,
                token_version
            `,
            [
                tenant.rows[0].id,
                nome,
                email,
                senhaHash,
                telefone
            ]
        );

        await c.query(
            `
            INSERT INTO assinaturas(
                barbearia_id,
                plano,
                status,
                inicio,
                fim_trial
            )
            VALUES(
                $1,
                'premium',
                'trial_pendente',
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '7 days'
            )
            `,
            [
                tenant.rows[0].id
            ]
        );

        const token =
            createEmailVerificationToken(
                usuario.rows[0]
            );

        await c.query('COMMIT');

        try {
            await sendVerification(
                email,
                token
            );
        } catch (erroEmail) {

            console.error(
                'verification_email_failed',
                erroEmail.message
            );
        }

        return res.status(201).json({
            mensagem:
                'Conta criada. Confirme seu e-mail para ativar o trial Premium.',
            email_verification_required: true
        });

    } catch (e) {

        await c
            .query('ROLLBACK')
            .catch(() => {});

        if (e?.code === '23505') {
            return res.status(409).json({
                erro:
                    'E-mail ou identificador já utilizado'
            });
        }

        console.error(
            'registration_failed',
            e
        );

        return res.status(500).json({
            erro:
                'Erro ao criar conta'
        });

    } finally {

        c.release();
    }
});

/* =========================================================
   CONFIRMAR E-MAIL
   Compatível com:
   - JWT novo
   - token hash antigo
========================================================= */

router.post('/verificar-email', async (req, res) => {

    const token = String(
        req.body?.token || ''
    ).trim();

    if (
        !token ||
        token.length < 32 ||
        token.length > 1000 ||
        !/^[A-Za-z0-9._-]+$/.test(token)
    ) {
        return res.status(400).json({
            erro:
                'Link inválido ou expirado'
        });
    }

    let jwtPayload = null;
    let tokenNovo = false;

    if (token.includes('.')) {

        tokenNovo = true;

        try {

            jwtPayload = jwt.verify(
                token,
                process.env.JWT_SECRET,
                {
                    algorithms: ['HS256']
                }
            );

            if (
                jwtPayload.purpose !==
                'email_verify'
            ) {
                throw new Error(
                    'Purpose inválido'
                );
            }

        } catch {

            return res.status(400).json({
                erro:
                    'Link inválido ou expirado'
            });
        }
    }

    const c = await pool.connect();

    try {

        await c.query('BEGIN');

        let usuario;

        /*
         * TOKEN NOVO - JWT
         */
        if (tokenNovo) {

            const usuarioId =
                Number(jwtPayload.id);

            const barbeariaId =
                Number(
                    jwtPayload.barbearia_id
                );

            const tokenVersion =
                Number(jwtPayload.sv);

            if (
                !Number.isSafeInteger(
                    usuarioId
                ) ||
                usuarioId <= 0 ||
                !Number.isSafeInteger(
                    barbeariaId
                ) ||
                barbeariaId <= 0 ||
                !Number.isSafeInteger(
                    tokenVersion
                ) ||
                tokenVersion < 0
            ) {

                await c.query(
                    'ROLLBACK'
                );

                return res.status(400).json({
                    erro:
                        'Link inválido ou expirado'
                });
            }

            const r = await c.query(
                `
                SELECT
                    u.id AS usuario_id,
                    u.barbearia_id,
                    COALESCE(
                        u.token_version,
                        0
                    )::int
                        AS token_version,
                    b.email_verificado
                FROM usuarios u
                JOIN barbearias b
                  ON b.id = u.barbearia_id
                WHERE
                    u.id = $1
                    AND u.barbearia_id = $2
                    AND u.ativo = true
                    AND u.papel = 'dono'
                    AND COALESCE(
                        b.is_system,
                        false
                    ) = false
                    AND b.excluido_em IS NULL
                FOR UPDATE
                `,
                [
                    usuarioId,
                    barbeariaId
                ]
            );

            if (!r.rowCount) {

                await c.query(
                    'ROLLBACK'
                );

                return res.status(400).json({
                    erro:
                        'Link inválido ou expirado'
                });
            }

            usuario = r.rows[0];

            /*
             * Já confirmou anteriormente:
             * responder sucesso.
             */
            if (
                usuario.email_verificado
            ) {

                await c.query(
                    'COMMIT'
                );

                return res.json({
                    mensagem:
                        'E-mail já confirmado. Você já pode entrar.'
                });
            }

            if (
                Number(
                    usuario.token_version
                ) !== tokenVersion
            ) {

                await c.query(
                    'ROLLBACK'
                );

                return res.status(400).json({
                    erro:
                        'Link inválido ou expirado'
                });
            }

        } else {

            /*
             * TOKEN ANTIGO
             * Compatibilidade temporária
             */

            const r = await c.query(
                `
                SELECT
                    evt.id AS token_id,
                    evt.usuario_id,
                    u.barbearia_id,
                    COALESCE(
                        u.token_version,
                        0
                    )::int
                        AS token_version,
                    b.email_verificado
                FROM email_verification_tokens evt
                JOIN usuarios u
                  ON u.id = evt.usuario_id
                JOIN barbearias b
                  ON b.id = u.barbearia_id
                WHERE
                    evt.token_hash = $1
                    AND evt.usado = false
                    AND evt.expira_em > NOW()
                    AND u.ativo = true
                    AND u.papel = 'dono'
                    AND COALESCE(
                        b.is_system,
                        false
                    ) = false
                    AND b.excluido_em IS NULL
                FOR UPDATE
                `,
                [
                    sha256(token)
                ]
            );

            if (!r.rowCount) {

                await c.query(
                    'ROLLBACK'
                );

                return res.status(400).json({
                    erro:
                        'Link inválido ou expirado'
                });
            }

            usuario = r.rows[0];

            if (
                usuario.email_verificado
            ) {

                await c.query(
                    `
                    UPDATE email_verification_tokens
                    SET usado = true
                    WHERE usuario_id = $1
                      AND usado = false
                    `,
                    [
                        usuario.usuario_id
                    ]
                );

                await c.query(
                    'COMMIT'
                );

                return res.json({
                    mensagem:
                        'E-mail já confirmado. Você já pode entrar.'
                });
            }
        }

        /*
         * CONFIRMA BARBEARIA
         */

        await c.query(
            `
            UPDATE barbearias
            SET
                email_verificado = true,
                atualizado_em = NOW()
            WHERE id = $1
            `,
            [
                usuario.barbearia_id
            ]
        );

        /*
         * ATIVA TRIAL
         */

        await c.query(
            `
            UPDATE assinaturas
            SET
                status = 'trial',
                inicio = CURRENT_DATE,
                fim_trial =
                    CURRENT_DATE +
                    INTERVAL '7 days',
                atualizado_em = NOW()
            WHERE id = (
                SELECT id
                FROM assinaturas
                WHERE barbearia_id = $1
                ORDER BY id DESC
                LIMIT 1
            )
            `,
            [
                usuario.barbearia_id
            ]
        );

        /*
         * INVALIDA TOKENS ANTIGOS
         */

        await c.query(
            `
            UPDATE email_verification_tokens
            SET usado = true
            WHERE usuario_id = $1
              AND usado = false
            `,
            [
                usuario.usuario_id
            ]
        );

        await c.query('COMMIT');

        return res.json({
            mensagem:
                'E-mail confirmado. Seu trial Premium de 7 dias começou.'
        });

    } catch (e) {

        await c
            .query('ROLLBACK')
            .catch(() => {});

        console.error(
            'email_verification_failed',
            e.message
        );

        return res.status(500).json({
            erro:
                'Não foi possível confirmar o e-mail agora'
        });

    } finally {

        c.release();
    }
});

/* =========================================================
   REENVIAR VERIFICAÇÃO
========================================================= */

router.post(
    '/reenviar-verificacao',
    async (req, res) => {

        const email = String(
            req.body?.email || ''
        )
            .trim()
            .toLowerCase();

        const respostaGenerica = {
            mensagem:
                'Se a conta existir, enviaremos uma nova confirmação.'
        };

        if (!validEmail(email)) {
            return res.json(
                respostaGenerica
            );
        }

        const r = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.barbearia_id,
                COALESCE(
                    u.token_version,
                    0
                )::int
                    AS token_version,
                b.email_verificado
            FROM usuarios u
            JOIN barbearias b
              ON b.id = u.barbearia_id
            WHERE
                LOWER(u.email) = LOWER($1)
                AND u.ativo = true
                AND u.papel = 'dono'
                AND COALESCE(
                    b.is_system,
                    false
                ) = false
                AND b.excluido_em IS NULL
            LIMIT 1
            `,
            [email]
        );

        if (
            !r.rowCount ||
            r.rows[0].email_verificado
        ) {
            return res.json(
                respostaGenerica
            );
        }

        const token =
            createEmailVerificationToken(
                r.rows[0]
            );

        try {

            await sendVerification(
                r.rows[0].email,
                token
            );

        } catch (e) {

            console.error(
                'verification_email_failed',
                e.message
            );

            if (
                process.env.NODE_ENV ===
                'production'
            ) {
                return res.status(503).json({
                    erro:
                        'Não foi possível enviar a confirmação agora'
                });
            }
        }

        return res.json(
            respostaGenerica
        );
    }
);

/* =========================================================
   LOGIN
========================================================= */

router.post('/login', async (req, res) => {

    const {
        email,
        senha,
        mfa_code
    } = req.body;

    const r = await pool.query(
        `
        SELECT
            u.*,
            b.nome AS barbearia_nome,
            b.slug,
            COALESCE(
                b.email_verificado,
                true
            ) AS email_verificado
        FROM usuarios u
        JOIN barbearias b
          ON b.id = u.barbearia_id
        WHERE
            LOWER(u.email) =
                LOWER($1)
            AND u.ativo = true
            AND (
                u.papel = 'super_admin'
                OR (
                    b.ativo = true
                    AND b.excluido_em IS NULL
                )
            )
        `,
        [
            email || ''
        ]
    );

    if (
        !r.rowCount ||
        !(
            await bcrypt.compare(
                senha || '',
                r.rows[0].senha_hash
            )
        )
    ) {
        return res.status(401).json({
            erro:
                'E-mail ou senha inválidos'
        });
    }

    const usuario =
        r.rows[0];

    if (
        usuario.papel !==
            'super_admin' &&
        !usuario.email_verificado
    ) {
        return res.status(403).json({
            erro:
                'Confirme seu e-mail antes de entrar',
            email_verification_required: true
        });
    }

    /*
     * MFA SUPERMASTER
     */
    if (
        usuario.papel ===
        'super_admin'
    ) {

        if (!usuario.mfa_enabled) {

            const setupToken =
                jwt.sign(
                    {
                        purpose:
                            'mfa_setup',
                        id: usuario.id,
                        sv: Number(
                            usuario.token_version ||
                            0
                        )
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: '10m',
                        algorithm: 'HS256'
                    }
                );

            return res
                .status(428)
                .json({
                    erro:
                        'MFA obrigatório para o Supermaster',
                    mfa_setup_required: true,
                    setup_token:
                        setupToken
                });
        }

        let secret;

        try {
            secret =
                decrypt(
                    usuario.mfa_secret_enc
                );
        } catch {

            return res
                .status(500)
                .json({
                    erro:
                        'MFA indisponível'
                });
        }

        if (
            !verifyTotp(
                secret,
                mfa_code
            )
        ) {
            return res
                .status(428)
                .json({
                    erro:
                        'Código MFA obrigatório ou inválido',
                    mfa_required: true
                });
        }
    }

    await pool.query(
        `
        UPDATE usuarios
        SET atualizado_em = NOW()
        WHERE id = $1
        `,
        [
            usuario.id
        ]
    );

    const csrf =
        setSession(
            res,
            usuario
        );

    const plano =
        await contextoPlano(
            usuario.barbearia_id
        );

    return res.json({
        csrf_token: csrf,

        usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            papel: usuario.papel,
            barbeiro_id:
                usuario.barbeiro_id
        },

        barbearia: {
            id: usuario.barbearia_id,
            nome:
                usuario.barbearia_nome,
            slug: usuario.slug
        },

        assinatura: {
            ...plano.assinatura,
            plano_efetivo:
                plano.plano_efetivo,
            recursos:
                plano.recursos,
            trial_ativo:
                plano.trial_ativo,
            dias_trial:
                plano.dias_trial
        }
    });
});

/* =========================================================
   MFA SETUP
========================================================= */

router.post(
    '/mfa/setup',
    async (req, res) => {

        try {

            const payload =
                jwt.verify(
                    req.body.setup_token,
                    process.env.JWT_SECRET,
                    {
                        algorithms:
                            ['HS256']
                    }
                );

            if (
                payload.purpose !==
                'mfa_setup'
            ) {
                throw new Error(
                    'Purpose inválido'
                );
            }

            const r =
                await pool.query(
                    `
                    SELECT
                        id,
                        email,
                        papel,
                        COALESCE(
                            token_version,
                            0
                        )::int
                            AS token_version
                    FROM usuarios
                    WHERE
                        id = $1
                        AND ativo = true
                    `,
                    [
                        payload.id
                    ]
                );

            const usuario =
                r.rows[0];

            if (
                !usuario ||
                usuario.papel !==
                    'super_admin' ||
                Number(
                    payload.sv ??
                    -1
                ) !==
                    Number(
                        usuario.token_version ||
                        0
                    )
            ) {
                throw new Error(
                    'Setup inválido'
                );
            }

            const secret =
                generateSecret();

            await pool.query(
                `
                UPDATE usuarios
                SET
                    mfa_secret_enc = $1,
                    mfa_enabled = false
                WHERE id = $2
                `,
                [
                    encrypt(secret),
                    usuario.id
                ]
            );

            return res.json({
                secret,
                otpauth_uri:
                    otpauthUri({
                        secret,
                        email:
                            usuario.email
                    })
            });

        } catch {

            return res
                .status(401)
                .json({
                    erro:
                        'Setup MFA inválido ou expirado'
                });
        }
    }
);

/* =========================================================
   MFA CONFIRM
========================================================= */

router.post(
    '/mfa/confirm',
    async (req, res) => {

        try {

            const payload =
                jwt.verify(
                    req.body.setup_token,
                    process.env.JWT_SECRET,
                    {
                        algorithms:
                            ['HS256']
                    }
                );

            if (
                payload.purpose !==
                'mfa_setup'
            ) {
                throw new Error(
                    'Purpose inválido'
                );
            }

            const r =
                await pool.query(
                    `
                    SELECT
                        u.*,
                        b.nome
                            AS barbearia_nome,
                        b.slug
                    FROM usuarios u
                    JOIN barbearias b
                      ON b.id =
                         u.barbearia_id
                    WHERE
                        u.id = $1
                        AND u.ativo = true
                    `,
                    [
                        payload.id
                    ]
                );

            const usuario =
                r.rows[0];

            if (
                !usuario ||
                usuario.papel !==
                    'super_admin' ||
                Number(
                    payload.sv ??
                    -1
                ) !==
                    Number(
                        usuario.token_version ||
                        0
                    )
            ) {
                throw new Error(
                    'Setup inválido'
                );
            }

            const secret =
                decrypt(
                    usuario.mfa_secret_enc
                );

            if (
                !verifyTotp(
                    secret,
                    req.body.code
                )
            ) {
                return res
                    .status(400)
                    .json({
                        erro:
                            'Código inválido'
                    });
            }

            await pool.query(
                `
                UPDATE usuarios
                SET
                    mfa_enabled = true,
                    token_version =
                        COALESCE(
                            token_version,
                            0
                        ) + 1
                WHERE id = $1
                `,
                [
                    usuario.id
                ]
            );

            usuario.token_version =
                Number(
                    usuario.token_version ||
                    0
                ) + 1;

            const csrf =
                setSession(
                    res,
                    usuario
                );

            return res.json({
                csrf_token: csrf,

                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    papel:
                        usuario.papel
                },

                barbearia: {
                    id:
                        usuario.barbearia_id,
                    nome:
                        usuario.barbearia_nome,
                    slug:
                        usuario.slug
                }
            });

        } catch {

            return res
                .status(401)
                .json({
                    erro:
                        'Setup MFA inválido ou expirado'
                });
        }
    }
);

/* =========================================================
   STEP-UP
========================================================= */

router.post(
    '/step-up',
    autenticar,
    async (req, res) => {

        const r =
            await pool.query(
                `
                SELECT
                    senha_hash,
                    papel,
                    mfa_enabled,
                    mfa_secret_enc
                FROM usuarios
                WHERE id = $1
                `,
                [
                    req.usuario.id
                ]
            );

        const usuario =
            r.rows[0];

        if (
            !usuario ||
            !(
                await bcrypt.compare(
                    String(
                        req.body.senha ||
                        ''
                    ),
                    usuario.senha_hash
                )
            )
        ) {
            return res
                .status(401)
                .json({
                    erro:
                        'Senha atual incorreta'
                });
        }

        if (
            usuario.papel ===
            'super_admin'
        ) {

            if (!usuario.mfa_enabled) {
                return res
                    .status(403)
                    .json({
                        erro:
                            'MFA obrigatório'
                    });
            }

            if (
                !verifyTotp(
                    decrypt(
                        usuario.mfa_secret_enc
                    ),
                    req.body.mfa_code
                )
            ) {
                return res
                    .status(401)
                    .json({
                        erro:
                            'Código MFA inválido'
                    });
            }
        }

        const token =
            jwt.sign(
                {
                    purpose:
                        'stepup',
                    id:
                        req.usuario.id,
                    sv:
                        Number(
                            req.usuario.token_version ||
                            0
                        )
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '10m',
                    algorithm: 'HS256'
                }
            );

        res.cookie(
            'bf_stepup',
            token,
            {
                httpOnly: true,
                secure:
                    process.env.NODE_ENV ===
                    'production',
                sameSite: 'lax',
                path: '/',
                maxAge:
                    10 * 60 * 1000
            }
        );

        return res.json({
            mensagem:
                'Confirmação de segurança válida por 10 minutos'
        });
    }
);

/* =========================================================
   LOGOUT
========================================================= */

router.post(
    '/logout',
    autenticar,
    async (req, res) => {

        await pool.query(
            `
            UPDATE usuarios
            SET token_version =
                COALESCE(
                    token_version,
                    0
                ) + 1
            WHERE id = $1
            `,
            [
                req.usuario.id
            ]
        );

        clearSession(res);

        res.clearCookie(
            'bf_stepup',
            {
                path: '/'
            }
        );

        return res.json({
            mensagem:
                'Sessão encerrada e tokens anteriores revogados'
        });
    }
);

/* =========================================================
   SOLICITAR RESET DE SENHA
========================================================= */

router.post(
    '/solicitar-reset',
    async (req, res) => {

        const email = String(
            req.body?.email || ''
        )
            .trim()
            .toLowerCase();

        const r =
            await pool.query(
                `
                SELECT
                    id,
                    email
                FROM usuarios
                WHERE
                    LOWER(email) =
                        LOWER($1)
                    AND ativo = true
                `,
                [
                    email
                ]
            );

        if (!r.rowCount) {
            return res.json({
                mensagem:
                    'Se o e-mail existir, as instruções serão enviadas.'
            });
        }

        await pool.query(
            `
            DELETE FROM password_resets
            WHERE
                usuario_id = $1
                AND (
                    usado = true
                    OR expira_em <= NOW()
                )
            `,
            [
                r.rows[0].id
            ]
        );

        const raw =
            crypto
                .randomBytes(32)
                .toString('hex');

        const ins =
            await pool.query(
                `
                INSERT INTO password_resets(
                    usuario_id,
                    token_hash,
                    expira_em
                )
                VALUES(
                    $1,
                    $2,
                    NOW() +
                    INTERVAL '30 minutes'
                )
                RETURNING id
                `,
                [
                    r.rows[0].id,
                    sha256(raw)
                ]
            );

        const base = (
            process.env.APP_URL ||
            'http://localhost:3001'
        ).replace(/\/$/, '');

        const link =
            `${base}/redefinir-senha.html?token=${encodeURIComponent(raw)}`;

        if (
            process.env.RESEND_API_KEY &&
            process.env.EMAIL_FROM
        ) {

            try {

                const respostaEmail =
                    await fetch(
                        'https://api.resend.com/emails',
                        {
                            method: 'POST',

                            headers: {
                                Authorization:
                                    `Bearer ${process.env.RESEND_API_KEY}`,
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify({
                                    from:
                                        process.env.EMAIL_FROM,
                                    to:
                                        [
                                            r.rows[0]
                                                .email
                                        ],
                                    subject:
                                        'Redefinição de senha BarberFlow',
                                    html: `
                                        <p>
                                            Recebemos uma solicitação para redefinir sua senha.
                                        </p>

                                        <p>
                                            <a href="${link}">
                                                Redefinir senha
                                            </a>
                                        </p>

                                        <p>
                                            Este link expira em 30 minutos.
                                        </p>
                                    `
                                }),

                            signal:
                                externalSignal()
                        }
                    );

                if (
                    !respostaEmail.ok
                ) {
                    const detalhe =
                        await respostaEmail
                            .text()
                            .catch(
                                () => ''
                            );

                    throw new Error(
                        `Falha no provedor de e-mail (${respostaEmail.status}) ${detalhe.slice(0, 300)}`
                    );
                }

            } catch (e) {

                await pool
                    .query(
                        `
                        DELETE FROM password_resets
                        WHERE id = $1
                        `,
                        [
                            ins.rows[0].id
                        ]
                    )
                    .catch(() => {});

                console.error(
                    'reset_email_failed',
                    e.message
                );

                if (
                    process.env.NODE_ENV ===
                    'production'
                ) {
                    return res
                        .status(503)
                        .json({
                            erro:
                                'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.'
                        });
                }
            }

        } else if (
            process.env.NODE_ENV !==
            'production'
        ) {

            console.log(
                'Reset DEV:',
                link
            );
        }

        return res.json({
            mensagem:
                'Se o e-mail existir, as instruções serão enviadas.'
        });
    }
);

/* =========================================================
   VALIDAR TOKEN DE RESET
========================================================= */

router.post(
    '/validar-reset',
    async (req, res) => {

        const token = String(
            req.body?.token || ''
        ).trim();

        if (
            !/^[a-f0-9]{64}$/i.test(
                token
            )
        ) {
            return res
                .status(400)
                .json({
                    valido: false
                });
        }

        const r =
            await pool.query(
                `
                SELECT 1
                FROM password_resets
                WHERE
                    token_hash = $1
                    AND usado = false
                    AND expira_em > NOW()
                LIMIT 1
                `,
                [
                    sha256(token)
                ]
            );

        if (!r.rowCount) {
            return res
                .status(400)
                .json({
                    valido: false
                });
        }

        return res.json({
            valido: true
        });
    }
);

/* =========================================================
   REDEFINIR SENHA
========================================================= */

router.post(
    '/redefinir-senha',
    async (req, res) => {

        const resetToken =
            String(
                req.body?.token ||
                ''
            ).trim();

        const senha =
            String(
                req.body?.senha ||
                ''
            );

        if (
            !/^[a-f0-9]{64}$/i.test(
                resetToken
            )
        ) {
            return res
                .status(400)
                .json({
                    erro:
                        'Link inválido ou expirado'
                });
        }

        if (!strongPassword(senha)) {
            return res
                .status(400)
                .json({
                    erro:
                        'Use uma senha forte com 12+ caracteres, maiúscula, minúscula, número e símbolo'
                });
        }

        const c =
            await pool.connect();

        try {

            await c.query(
                'BEGIN'
            );

            const r =
                await c.query(
                    `
                    SELECT *
                    FROM password_resets
                    WHERE
                        token_hash = $1
                        AND usado = false
                        AND expira_em > NOW()
                    ORDER BY id DESC
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        sha256(
                            resetToken
                        )
                    ]
                );

            if (!r.rowCount) {

                await c.query(
                    'ROLLBACK'
                );

                return res
                    .status(400)
                    .json({
                        erro:
                            'Link inválido ou expirado'
                    });
            }

            const senhaHash =
                await bcrypt.hash(
                    senha,
                    12
                );

            await c.query(
                `
                UPDATE usuarios
                SET
                    senha_hash = $1,
                    token_version =
                        COALESCE(
                            token_version,
                            0
                        ) + 1
                WHERE id = $2
                `,
                [
                    senhaHash,
                    r.rows[0]
                        .usuario_id
                ]
            );

            await c.query(
                `
                UPDATE password_resets
                SET usado = true
                WHERE usuario_id = $1
                `,
                [
                    r.rows[0]
                        .usuario_id
                ]
            );

            await c.query(
                'COMMIT'
            );

            clearSession(res);

            res.clearCookie(
                'bf_stepup',
                {
                    path: '/'
                }
            );

            return res.json({
                mensagem:
                    'Senha atualizada. Todas as sessões anteriores foram revogadas.'
            });

        } catch (e) {

            await c
                .query('ROLLBACK')
                .catch(() => {});

            console.error(
                'password_reset_failed',
                e.message
            );

            return res
                .status(500)
                .json({
                    erro:
                        'Não foi possível redefinir a senha agora'
                });

        } finally {

            c.release();
        }
    }
);

/* =========================================================
   USUÁRIO ATUAL
========================================================= */

router.get(
    '/me',
    autenticar,
    async (req, res) => {

        const r =
            await pool.query(
                `
                SELECT
                    u.id,
                    u.nome,
                    u.email,
                    u.telefone,
                    u.papel,
                    u.barbeiro_id,
                    u.mfa_enabled,
                    b.id
                        AS barbearia_id,
                    b.nome
                        AS barbearia_nome,
                    b.slug
                FROM usuarios u
                JOIN barbearias b
                  ON b.id =
                     u.barbearia_id
                WHERE
                    u.id = $1
                `,
                [
                    req.usuario.id
                ]
            );

        if (!r.rowCount) {
            return res
                .status(404)
                .json({
                    erro:
                        'Usuário não encontrado'
                });
        }

        return res.json(
            r.rows[0]
        );
    }
);

module.exports = router;