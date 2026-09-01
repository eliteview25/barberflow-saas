const express = require('express');
const { externalSignal } = require('../utils/http');
const bcrypt = require('bcryptjs');
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
    normalizePhone,
    signAppToken,
    verifyAppToken
} = require('../utils/security');

const {
    generateSecret,
    matchingTotpStep,
    otpauthUri
} = require('../utils/totp');

const { cleanText } = require('../utils/validation');
const {LEGAL_VERSION}=require('../services/launchReadiness');
const {notificar}=require('../services/notifications');
const {sendVerificationEmail}=require('../services/email');
const {checkLoginThrottle,recordLoginFailure,clearLoginFailures,verifyAndConsumeTotp}=require('../services/accountSecurity');

const router = express.Router();
const DUMMY_PASSWORD_HASH='$2b$12$C6UzMDM.H6dfI/f/IKcEe.5onZl1LQH02lNLTQnBLoG/5.uq2qKma';


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

function boundedPassword(value){const s=String(value||'');return Buffer.byteLength(s,'utf8')<=72?s:''}


router.get('/security-config', (req, res) => {
    return res.json({
        turnstile_site_key:
            process.env.TURNSTILE_SITE_KEY || null
    });
});


function signSession(usuario) {
    return signAppToken(
        {
            purpose: 'session',
            id: usuario.id,
            barbearia_id: usuario.barbearia_id,
            papel: usuario.papel,
            nome: usuario.nome,
            sv: Number(usuario.token_version || 0)
        },
        {
            expiresIn: '12h'
        }
    );
}


function setStepUpCookie(res,usuario,metodo){
    const token=signAppToken({purpose:'stepup',id:usuario.id,sv:Number(usuario.token_version||0),metodo},{expiresIn:'10m'});
    res.cookie('bf_stepup',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:10*60*1000});
}

function setSession(res, usuario,{freshAuthMethod=null}={}) {

    const token = signSession(usuario);

    const csrf = randomToken(24);

    sessionCookie(res, token);

    csrfCookie(res, csrf);

    if(freshAuthMethod)setStepUpCookie(res,usuario,freshAuthMethod);

    return csrf;
}


/* =========================================================
   REGISTRAR NOVA BARBEARIA
   E-mail precisa ser confirmado
   Trial Premium começa após a confirmação
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
        {
            required: true
        }
    );


    const nome = cleanText(
        req.body?.nome,
        120,
        {
            required: true
        }
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
        normalizePhone(
            req.body?.telefone
        ) || null;


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


    if (req.body?.aceite_termos !== true || req.body?.aceite_privacidade !== true) {
        return res.status(400).json({erro:'Você precisa aceitar os Termos de Uso e a Política de Privacidade'});
    }


    if (
        !validEmail(email) ||
        email.length > 160
    ) {
        return res.status(400).json({
            erro:
                'E-mail inválido'
        });
    }


    if (
        req.body?.telefone &&
        (
            !telefone ||
            telefone.length < 10
        )
    ) {
        return res.status(400).json({
            erro:
                'Telefone inválido'
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


        const emailExiste =
            await c.query(
                `
                SELECT 1
                FROM usuarios
                WHERE LOWER(email) = LOWER($1)
                `,
                [
                    email
                ]
            );


        if (emailExiste.rowCount) {

            await c.query(
                'ROLLBACK'
            );

            return res.status(409).json({
                erro:
                    'E-mail já cadastrado'
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
            [
                `signup-slug:${base}`
            ]
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
                    [
                        slug
                    ]
                )
            ).rowCount
        ) {

            slug =
                `${base.slice(0, 94)}-${++i}`;
        }


        const tenant =
            await c.query(
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


        const usuario =
            await c.query(
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

        const verificationToken=randomToken(32);
        await c.query(
            `INSERT INTO email_verification_tokens(usuario_id,token_hash,expira_em)
             VALUES($1,$2,NOW()+INTERVAL '24 hours')`,
            [usuario.rows[0].id,sha256(verificationToken)]
        );


        await c.query(`INSERT INTO legal_acceptances(usuario_id,barbearia_id,documento,versao,ip,user_agent)
            VALUES($1,$2,'termos',$3,$4,$5),($1,$2,'privacidade',$3,$4,$5)
            ON CONFLICT(usuario_id,documento,versao) DO NOTHING`,[
            usuario.rows[0].id,tenant.rows[0].id,LEGAL_VERSION,req.ip||null,String(req.headers['user-agent']||'').slice(0,1000)||null
        ]);


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
                NULL,
                NULL
            )
            `,
            [
                tenant.rows[0].id
            ]
        );


        await c.query(
            'COMMIT'
        );

        sendVerificationEmail({to:email,token:verificationToken})
            .catch(e=>console.error('verification_email_failed',e.message));

        notificar('nova_barbearia',{barbearia_id:tenant.rows[0].id,barbearia:tenant.rows[0].nome,usuario_id:usuario.rows[0].id}).catch(()=>{});


        return res.status(201).json({
            mensagem:
                'Conta criada. Confirme seu e-mail para iniciar o trial Premium de 7 dias.',
            email_verification_required:true,
            usuario: {
                id:
                    usuario.rows[0].id,
                nome:
                    usuario.rows[0].nome,
                email:
                    usuario.rows[0].email,
                papel:
                    usuario.rows[0].papel
            },
            barbearia: {
                id:
                    tenant.rows[0].id,
                nome:
                    tenant.rows[0].nome,
                slug:
                    tenant.rows[0].slug
            }
        });


    } catch (e) {

        await c
            .query('ROLLBACK')
            .catch(() => {});


        if (
            e?.code === '23505'
        ) {
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


router.post(
    '/verificar-email',
    async (req, res) => {
        const token=String(req.body?.token||'').trim();
        if(!/^[A-Za-z0-9_-]{40,100}$/.test(token))return res.status(400).json({erro:'Link inválido ou expirado'});
        const db=await pool.connect();
        try{
            await db.query('BEGIN');
            const r=await db.query(`SELECT evt.id,evt.usuario_id,u.barbearia_id,b.email_verificado
                FROM email_verification_tokens evt
                JOIN usuarios u ON u.id=evt.usuario_id AND u.ativo=true
                JOIN barbearias b ON b.id=u.barbearia_id AND COALESCE(b.is_system,false)=false
                WHERE evt.token_hash=$1 AND evt.usado=false AND evt.expira_em>NOW()
                FOR UPDATE OF evt,b`,[sha256(token)]);
            if(!r.rowCount){await db.query('ROLLBACK');return res.status(400).json({erro:'Link inválido ou expirado'})}
            const row=r.rows[0];
            await db.query(`UPDATE email_verification_tokens SET usado=true WHERE usuario_id=$1`,[row.usuario_id]);
            await db.query(`UPDATE barbearias SET email_verificado=true WHERE id=$1 AND COALESCE(is_system,false)=false`,[row.barbearia_id]);
            await db.query(`UPDATE assinaturas SET status='trial',inicio=CURRENT_DATE,fim_trial=CURRENT_DATE+INTERVAL '7 days',atualizado_em=NOW()
                WHERE id=(SELECT id FROM assinaturas WHERE barbearia_id=$1 AND status='trial_pendente' ORDER BY id DESC LIMIT 1)`,[row.barbearia_id]);
            await db.query('COMMIT');
            return res.json({mensagem:'E-mail confirmado. Seu trial Premium de 7 dias começou.'});
        }catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('email_verification_failed',e.message);return res.status(500).json({erro:'Não foi possível confirmar o e-mail agora'})}finally{db.release()}
    }
);


router.post(
    '/reenviar-verificacao',
    async (req, res) => {
        const generic={mensagem:'Se a conta estiver pendente, um novo link será enviado.'};
        const email=String(req.body?.email||'').trim().toLowerCase();
        if(email.length>160||!validEmail(email))return res.json(generic);
        try{
            const r=await pool.query(`SELECT u.id,u.email FROM usuarios u JOIN barbearias b ON b.id=u.barbearia_id
                WHERE LOWER(u.email)=LOWER($1) AND u.ativo=true AND COALESCE(b.is_system,false)=false AND COALESCE(b.email_verificado,false)=false`,[email]);
            if(!r.rowCount)return res.json(generic);
            const recent=await pool.query(`SELECT 1 FROM email_verification_tokens WHERE usuario_id=$1 AND criado_em>NOW()-INTERVAL '2 minutes' LIMIT 1`,[r.rows[0].id]);
            if(recent.rowCount)return res.json(generic);
            const token=randomToken(32);
            await pool.query(`UPDATE email_verification_tokens SET usado=true WHERE usuario_id=$1 AND usado=false`,[r.rows[0].id]);
            await pool.query(`INSERT INTO email_verification_tokens(usuario_id,token_hash,expira_em) VALUES($1,$2,NOW()+INTERVAL '24 hours')`,[r.rows[0].id,sha256(token)]);
            await sendVerificationEmail({to:r.rows[0].email,token});
            return res.json(generic);
        }catch(e){console.error('resend_verification_failed',e.message);return res.status(503).json({erro:'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.'})}
    }
);


/* =========================================================
   LOGIN
========================================================= */

router.post('/login', async (req, res) => {
    const email=String(req.body?.email||'').trim().toLowerCase().slice(0,161);
    const senha=String(req.body?.senha||'');
    const mfa_code=String(req.body?.mfa_code||'').slice(0,12);
    const blocked=await checkLoginThrottle(email);
    if(blocked.blocked){
        res.setHeader('Retry-After',String(blocked.retryAfterSeconds));
        return res.status(429).json({erro:'Muitas tentativas. Aguarde e tente novamente.'});
    }


    const r =
        await pool.query(
            `
            SELECT
                u.*,
                COALESCE(NULLIF(u.foto_url,''), br.foto_url) AS foto_perfil_url,
                b.nome AS barbearia_nome,
                b.slug,
                COALESCE(b.email_verificado,false) AS email_verificado,
                COALESCE(b.is_system,false) AS is_system
            FROM usuarios u
            JOIN barbearias b
              ON b.id = u.barbearia_id
            LEFT JOIN barbeiros br
              ON br.id = u.barbeiro_id
             AND br.barbearia_id = u.barbearia_id
            WHERE
                LOWER(u.email) =
                    LOWER($1)

                AND u.ativo = true

                AND ((
                    u.papel = 'super_admin'
                    AND COALESCE(b.is_system,false)=true
                    ) OR (
                        u.papel <> 'super_admin'
                        AND COALESCE(b.is_system,false)=false
                        AND b.ativo = true
                        AND b.excluido_em IS NULL
                    )
                )
            `,
            [
                email
            ]
        );

    const passwordOk=await bcrypt.compare(boundedPassword(senha),r.rows[0]?.senha_hash||DUMMY_PASSWORD_HASH);
    if (!r.rowCount || !passwordOk || !validEmail(email)) {
        const fail=await recordLoginFailure(email);
        if(fail.blocked){res.setHeader('Retry-After',String(fail.retryAfterSeconds));return res.status(429).json({erro:'Muitas tentativas. Aguarde e tente novamente.'});}
        return res.status(401).json({
            erro:
                'E-mail ou senha inválidos'
        });
    }


    const usuario =
        r.rows[0];

    if(usuario.papel!=='super_admin'&&!usuario.email_verificado){
        await clearLoginFailures(email);
        return res.status(403).json({erro:'Confirme seu e-mail antes de entrar',codigo:'EMAIL_NAO_VERIFICADO',email_verification_required:true});
    }


    /* =====================================================
       MFA
       - obrigatório para Supermaster
       - opcional para os demais usuários
    ===================================================== */

    if (
        usuario.papel ===
        'super_admin' &&
        !usuario.mfa_enabled
    ) {

        await clearLoginFailures(email);

        const setupToken =
            signAppToken(
                {
                    purpose:
                        'mfa_setup',

                    id:
                        usuario.id,

                    sv:
                        Number(
                            usuario.token_version ||
                            0
                        )
                },

                {
                    expiresIn:
                        '10m'
                }
            );


        return res
            .status(428)
            .json({
                erro:
                    'MFA obrigatório para o Supermaster',

                mfa_setup_required:
                    true,

                setup_token:
                    setupToken
            });
    }


    if (usuario.mfa_enabled) {

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


        if (!(await verifyAndConsumeTotp(usuario.id,secret,mfa_code))) {
            const fail=await recordLoginFailure(email);
            if(fail.blocked){res.setHeader('Retry-After',String(fail.retryAfterSeconds));return res.status(429).json({erro:'Muitas tentativas. Aguarde e tente novamente.'});}
            return res
                .status(428)
                .json({
                    erro:
                        'Código MFA obrigatório ou inválido',

                    mfa_required:
                        true
                });
        }
    }

    await clearLoginFailures(email);


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
            usuario,
            {freshAuthMethod:usuario.mfa_enabled?'totp':'senha'}
        );


    const plano =
        await contextoPlano(
            usuario.barbearia_id
        );


    return res.json({
        csrf_token:
            csrf,

        usuario: {
            id:
                usuario.id,

            nome:
                usuario.nome,

            email:
                usuario.email,

            papel:
                usuario.papel,

            barbeiro_id:
                usuario.barbeiro_id,

            mfa_enabled:
                !!usuario.mfa_enabled,

            foto_url:
                usuario.foto_perfil_url || usuario.foto_url || null
        },

        barbearia: {
            id:
                usuario.barbearia_id,

            nome:
                usuario.barbearia_nome,

            slug:
                usuario.slug
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
                verifyAppToken(req.body.setup_token);


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
                        )::int AS token_version
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
                    mfa_enabled = false,
                    mfa_last_used_step = -1
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
                verifyAppToken(req.body.setup_token);


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
                        b.nome AS barbearia_nome,
                        b.slug
                    FROM usuarios u
                    JOIN barbearias b
                      ON b.id = u.barbearia_id
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


            if (!(await verifyAndConsumeTotp(usuario.id,secret,req.body.code))) {
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
                    usuario,
                    {freshAuthMethod:'totp'}
                );


            return res.json({
                csrf_token:
                    csrf,

                usuario: {
                    id:
                        usuario.id,

                    nome:
                        usuario.nome,

                    email:
                        usuario.email,

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
   SEGURANÇA DA CONTA
   Senha + MFA TOTP opcional para usuários da barbearia
========================================================= */

router.get(
    '/security-status',
    autenticar,
    async (req, res) => {
        const r = await pool.query(
            `SELECT COALESCE(mfa_enabled,false) AS mfa_enabled
             FROM usuarios
             WHERE id=$1 AND ativo=true`,
            [req.usuario.id]
        );

        if (!r.rowCount) {
            return res.status(404).json({
                erro: 'Usuário não encontrado'
            });
        }

        return res.json({
            mfa_enabled: !!r.rows[0].mfa_enabled,
            totp: {
                issuer: 'EliteFlow',
                digits: 6,
                period_seconds: 30,
                compatible_apps: [
                    'Google Authenticator',
                    'Microsoft Authenticator',
                    'Authy',
                    '1Password',
                    'Bitwarden',
                    'Aegis',
                    'FreeOTP'
                ],
                required: req.usuario.papel === 'super_admin'
            }
        });
    }
);


router.post(
    '/change-password',
    autenticar,
    async (req, res) => {
        const senhaAtual = String(req.body?.senha_atual || '');
        const novaSenha = String(req.body?.nova_senha || '');
        const mfaCode = String(req.body?.mfa_code || '');

        if (!strongPassword(novaSenha)) {
            return res.status(400).json({
                erro: 'Use uma senha com 12+ caracteres, maiúscula, minúscula, número e símbolo'
            });
        }

        const r = await pool.query(
            `SELECT senha_hash,COALESCE(mfa_enabled,false) AS mfa_enabled,mfa_secret_enc
             FROM usuarios
             WHERE id=$1 AND ativo=true`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senhaAtual), usuario.senha_hash))) {
            return res.status(400).json({
                erro: 'Senha atual incorreta'
            });
        }

        if (await bcrypt.compare(novaSenha, usuario.senha_hash)) {
            return res.status(400).json({
                erro: 'A nova senha precisa ser diferente da senha atual'
            });
        }

        if (usuario.mfa_enabled) {
            let secret;
            try {
                secret = decrypt(usuario.mfa_secret_enc);
            } catch {
                return res.status(500).json({ erro: 'MFA indisponível' });
            }

            if (!(await verifyAndConsumeTotp(req.usuario.id,secret,mfaCode))) {
                return res.status(400).json({
                    erro: 'Código MFA inválido'
                });
            }
        }

        const senhaHash = await bcrypt.hash(novaSenha, 12);
        const updated = await pool.query(
            `UPDATE usuarios
             SET senha_hash=$1,
                 token_version=COALESCE(token_version,0)+1,
                 atualizado_em=NOW()
             WHERE id=$2
             RETURNING COALESCE(token_version,0)::int AS token_version`,
            [senhaHash, req.usuario.id]
        );

        const tokenVersion = Number(updated.rows[0]?.token_version || 0);
        const csrf = setSession(res, {
            ...req.usuario,
            token_version: tokenVersion
        });

        res.clearCookie('bf_stepup', { path: '/' });

        return res.json({
            mensagem: 'Senha alterada. Outras sessões foram revogadas.',
            csrf_token: csrf
        });
    }
);


router.post(
    '/mfa/enroll',
    autenticar,
    async (req, res) => {
        const senha = String(req.body?.senha || '');
        const r = await pool.query(
            `SELECT email,senha_hash,COALESCE(mfa_enabled,false) AS mfa_enabled
             FROM usuarios
             WHERE id=$1 AND ativo=true`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senha), usuario.senha_hash))) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        if (usuario.mfa_enabled) {
            return res.status(409).json({ erro: 'A autenticação em dois fatores já está ativa' });
        }

        const secret = generateSecret();
        await pool.query(
            `UPDATE usuarios
             SET mfa_secret_enc=$1,mfa_enabled=false,mfa_last_used_step=-1,atualizado_em=NOW()
             WHERE id=$2`,
            [encrypt(secret), req.usuario.id]
        );

        return res.json({
            secret,
            otpauth_uri: otpauthUri({
                secret,
                email: usuario.email,
                issuer: 'EliteFlow'
            }),
            mensagem: 'Chave criada. Adicione-a ao seu aplicativo e confirme com um código de 6 dígitos.'
        });
    }
);


router.post(
    '/mfa/enable',
    autenticar,
    async (req, res) => {
        const senha = String(req.body?.senha || '');
        const code = String(req.body?.code || '');
        const r = await pool.query(
            `SELECT senha_hash,mfa_secret_enc,COALESCE(mfa_enabled,false) AS mfa_enabled
             FROM usuarios
             WHERE id=$1 AND ativo=true`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senha), usuario.senha_hash))) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        if (usuario.mfa_enabled) {
            return res.status(409).json({ erro: 'A autenticação em dois fatores já está ativa' });
        }

        if (!usuario.mfa_secret_enc) {
            return res.status(409).json({ erro: 'Inicie a configuração do 2FA antes de confirmar' });
        }

        let secret;
        try {
            secret = decrypt(usuario.mfa_secret_enc);
        } catch {
            return res.status(500).json({ erro: 'Não foi possível ler a configuração do MFA' });
        }

        if (!(await verifyAndConsumeTotp(req.usuario.id,secret,code))) {
            return res.status(400).json({ erro: 'Código de 6 dígitos inválido' });
        }

        const updated = await pool.query(
            `UPDATE usuarios
             SET mfa_enabled=true,
                 token_version=COALESCE(token_version,0)+1,
                 atualizado_em=NOW()
             WHERE id=$1
             RETURNING COALESCE(token_version,0)::int AS token_version`,
            [req.usuario.id]
        );

        const tokenVersion = Number(updated.rows[0]?.token_version || 0);
        const csrf = setSession(res, {
            ...req.usuario,
            token_version: tokenVersion
        });

        res.clearCookie('bf_stepup', { path: '/' });

        return res.json({
            mensagem: 'Autenticação em dois fatores ativada.',
            mfa_enabled: true,
            csrf_token: csrf
        });
    }
);


router.post(
    '/mfa/disable',
    autenticar,
    async (req, res) => {
        if (req.usuario.papel === 'super_admin') {
            return res.status(403).json({
                erro: 'O 2FA é obrigatório para o Supermaster. Use a opção de trocar o aplicativo autenticador.'
            });
        }

        const senha = String(req.body?.senha || '');
        const code = String(req.body?.code || '');
        const r = await pool.query(
            `SELECT senha_hash,mfa_secret_enc,COALESCE(mfa_enabled,false) AS mfa_enabled
             FROM usuarios
             WHERE id=$1 AND ativo=true`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senha), usuario.senha_hash))) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        if (!usuario.mfa_enabled || !usuario.mfa_secret_enc) {
            return res.status(409).json({ erro: 'A autenticação em dois fatores não está ativa' });
        }

        let secret;
        try {
            secret = decrypt(usuario.mfa_secret_enc);
        } catch {
            return res.status(500).json({ erro: 'MFA indisponível' });
        }

        if (!(await verifyAndConsumeTotp(req.usuario.id,secret,code))) {
            return res.status(400).json({ erro: 'Código MFA inválido' });
        }

        const updated = await pool.query(
            `UPDATE usuarios
             SET mfa_enabled=false,
                 mfa_secret_enc=NULL,
                 token_version=COALESCE(token_version,0)+1,
                 atualizado_em=NOW()
             WHERE id=$1
             RETURNING COALESCE(token_version,0)::int AS token_version`,
            [req.usuario.id]
        );

        const tokenVersion = Number(updated.rows[0]?.token_version || 0);
        const csrf = setSession(res, {
            ...req.usuario,
            token_version: tokenVersion
        });

        res.clearCookie('bf_stepup', { path: '/' });

        return res.json({
            mensagem: 'Autenticação em dois fatores desativada.',
            mfa_enabled: false,
            csrf_token: csrf
        });
    }
);



/* =========================================================
   TROCA SEGURA DO AUTENTICADOR DO SUPERMASTER
   A chave atual permanece ativa até a nova ser confirmada.
========================================================= */

router.post(
    '/mfa/rotate/start',
    autenticar,
    async (req, res) => {
        if (req.usuario.papel !== 'super_admin') {
            return res.status(403).json({ erro: 'Disponível apenas para o Supermaster' });
        }

        const senha = String(req.body?.senha || '');
        const code = String(req.body?.code || '');

        const r = await pool.query(
            `SELECT email,senha_hash,mfa_secret_enc,COALESCE(mfa_enabled,false) AS mfa_enabled
             FROM usuarios
             WHERE id=$1 AND ativo=true AND papel='super_admin'`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senha), usuario.senha_hash))) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        if (!usuario.mfa_enabled || !usuario.mfa_secret_enc) {
            return res.status(409).json({ erro: 'O 2FA atual precisa estar ativo para trocar o autenticador' });
        }

        let atual;
        try {
            atual = decrypt(usuario.mfa_secret_enc);
        } catch {
            return res.status(500).json({ erro: 'Não foi possível validar o 2FA atual' });
        }

        if (!(await verifyAndConsumeTotp(req.usuario.id,atual,code))) {
            return res.status(400).json({ erro: 'Código do autenticador atual inválido' });
        }

        const novoSecret = generateSecret();

        await pool.query(
            `UPDATE usuarios
             SET mfa_pending_secret_enc=$1,atualizado_em=NOW()
             WHERE id=$2`,
            [encrypt(novoSecret), req.usuario.id]
        );

        return res.json({
            secret: novoSecret,
            otpauth_uri: otpauthUri({
                secret: novoSecret,
                email: usuario.email,
                issuer: 'EliteFlow'
            }),
            compatible_apps: [
                'Google Authenticator',
                'Microsoft Authenticator',
                'Authy',
                '1Password',
                'Bitwarden',
                'Aegis',
                'FreeOTP'
            ],
            mensagem: 'Nova chave criada. O autenticador atual continua válido até a confirmação.'
        });
    }
);


router.post(
    '/mfa/rotate/confirm',
    autenticar,
    async (req, res) => {
        if (req.usuario.papel !== 'super_admin') {
            return res.status(403).json({ erro: 'Disponível apenas para o Supermaster' });
        }

        const senha = String(req.body?.senha || '');
        const code = String(req.body?.code || '');

        const r = await pool.query(
            `SELECT senha_hash,mfa_pending_secret_enc
             FROM usuarios
             WHERE id=$1 AND ativo=true AND papel='super_admin'`,
            [req.usuario.id]
        );

        const usuario = r.rows[0];

        if (!usuario || !(await bcrypt.compare(boundedPassword(senha), usuario.senha_hash))) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        if (!usuario.mfa_pending_secret_enc) {
            return res.status(409).json({ erro: 'Nenhuma troca de autenticador está pendente' });
        }

        let novoSecret;
        try {
            novoSecret = decrypt(usuario.mfa_pending_secret_enc);
        } catch {
            return res.status(500).json({ erro: 'Não foi possível ler a nova configuração de 2FA' });
        }

        const novoStep=matchingTotpStep(novoSecret,code);
        if (novoStep===null) {
            return res.status(400).json({ erro: 'Código do novo autenticador inválido' });
        }

        const updated = await pool.query(
            `UPDATE usuarios
             SET mfa_secret_enc=mfa_pending_secret_enc,
                 mfa_pending_secret_enc=NULL,
                 mfa_enabled=true,
                 mfa_last_used_step=$2,
                 token_version=COALESCE(token_version,0)+1,
                 atualizado_em=NOW()
             WHERE id=$1
             RETURNING COALESCE(token_version,0)::int AS token_version`,
            [req.usuario.id,novoStep]
        );

        const tokenVersion = Number(updated.rows[0]?.token_version || 0);
        const csrf = setSession(res, {
            ...req.usuario,
            token_version: tokenVersion
        });

        res.clearCookie('bf_stepup', { path: '/' });

        return res.json({
            mensagem: 'Novo autenticador ativado. A chave anterior foi invalidada.',
            mfa_enabled: true,
            csrf_token: csrf
        });
    }
);


router.post(
    '/mfa/rotate/cancel',
    autenticar,
    async (req, res) => {
        if (req.usuario.papel !== 'super_admin') {
            return res.status(403).json({ erro: 'Disponível apenas para o Supermaster' });
        }

        await pool.query(
            `UPDATE usuarios
             SET mfa_pending_secret_enc=NULL,atualizado_em=NOW()
             WHERE id=$1`,
            [req.usuario.id]
        );

        return res.json({
            mensagem: 'Troca cancelada. O autenticador atual continua válido.'
        });
    }
);


/* =========================================================
   STEP-UP
========================================================= */

router.post(
    '/step-up',
    autenticar,
    async (req, res) => {
        const throttle=await checkLoginThrottle(req.usuario.email);
        if(throttle.blocked){res.setHeader('Retry-After',String(throttle.retryAfterSeconds));return res.status(429).json({erro:'Muitas tentativas. Aguarde e tente novamente.'});}
        const r=await pool.query(`SELECT senha_hash,papel,COALESCE(mfa_enabled,false) AS mfa_enabled,mfa_secret_enc FROM usuarios WHERE id=$1`,[req.usuario.id]);
        const usuario=r.rows[0];if(!usuario)return res.status(401).json({erro:'Usuário não encontrado'});
        let metodo='senha';
        if(usuario.mfa_enabled){
            metodo='totp';let secret;try{secret=decrypt(usuario.mfa_secret_enc)}catch{return res.status(500).json({erro:'2FA indisponível'})}
            if(!(await verifyAndConsumeTotp(req.usuario.id,secret,req.body?.mfa_code))){const fail=await recordLoginFailure(req.usuario.email);if(fail.blocked)res.setHeader('Retry-After',String(fail.retryAfterSeconds));return res.status(fail.blocked?429:401).json({erro:fail.blocked?'Muitas tentativas. Aguarde e tente novamente.':'Código de autenticação inválido'});}
        }else{
            if(!(await bcrypt.compare(boundedPassword(req.body?.senha),usuario.senha_hash))){const fail=await recordLoginFailure(req.usuario.email);if(fail.blocked)res.setHeader('Retry-After',String(fail.retryAfterSeconds));return res.status(fail.blocked?429:401).json({erro:fail.blocked?'Muitas tentativas. Aguarde e tente novamente.':'Senha atual incorreta'});}
        }
        await clearLoginFailures(req.usuario.email);
        setStepUpCookie(res,req.usuario,metodo);
        return res.json({mensagem:'Confirmação de segurança válida por 10 minutos',metodo});
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
            SET
                token_version =
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
                path:
                    '/'
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

        const email =
            String(
                req.body?.email ||
                ''
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


        if (
            !r.rowCount
        ) {
            return res.json({
                mensagem:
                    'Se o e-mail existir, as instruções serão enviadas.'
            });
        }

        const recentReset=await pool.query(`SELECT 1 FROM password_resets WHERE usuario_id=$1 AND criado_em>NOW()-INTERVAL '2 minutes' LIMIT 1`,[r.rows[0].id]);
        if(recentReset.rowCount)return res.json({mensagem:'Se o e-mail existir, as instruções serão enviadas.'});


        await pool.query(
            `
            DELETE FROM password_resets
            WHERE usuario_id = $1
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


        const base =
            (
                process.env.APP_URL ||
                'http://localhost:3001'
            ).replace(
                /\/$/,
                ''
            );


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
                            method:
                                'POST',

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

                                    to: [
                                        r.rows[0].email
                                    ],

                                    subject:
                                        'Redefinição de senha EliteFlow',

                                    html:
                                        `
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
                    .catch(
                        () => {}
                    );


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
   VALIDAR RESET
========================================================= */

router.post(
    '/validar-reset',
    async (req, res) => {

        const token =
            String(
                req.body?.token ||
                ''
            ).trim();


        if (
            !/^[a-f0-9]{64}$/i.test(
                token
            )
        ) {
            return res
                .status(400)
                .json({
                    valido:
                        false
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


        if (
            !r.rowCount
        ) {
            return res
                .status(400)
                .json({
                    valido:
                        false
                });
        }


        return res.json({
            valido:
                true
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


        if (
            !strongPassword(senha)
        ) {
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


            if (
                !r.rowCount
            ) {

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
                    path:
                        '/'
                }
            );


            return res.json({
                mensagem:
                    'Senha atualizada. Todas as sessões anteriores foram revogadas.'
            });


        } catch (e) {

            await c
                .query('ROLLBACK')
                .catch(
                    () => {}
                );


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
                    COALESCE(NULLIF(u.foto_url,''), br.foto_url) AS foto_url,

                    b.id
                        AS barbearia_id,

                    b.nome
                        AS barbearia_nome,

                    b.slug

                FROM usuarios u

                JOIN barbearias b
                  ON b.id =
                     u.barbearia_id

                LEFT JOIN barbeiros br
                  ON br.id = u.barbeiro_id
                 AND br.barbearia_id = u.barbearia_id

                WHERE
                    u.id = $1
                `,
                [
                    req.usuario.id
                ]
            );


        if (
            !r.rowCount
        ) {
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
