import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { verifyPassword } from './password.js';

export function googleConfig() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_REDIRECT_URI: redirect } = process.env;
  if (!id && !secret && !redirect) return null;
  if (!id || !secret || !redirect) throw new Error('Preencha as três configurações OAuth do Google.');
  return { id, secret, redirect };
}

export function createGoogleRouter(db, config) {
  const router = Router();
  const oauth = config ? new OAuth2Client(config.id, config.secret, config.redirect) : null;
  const begin = async (req, res, linkingUser = null) => {
    if (!oauth) return res.status(503).render('erro', { mensagem: 'Google ainda não configurado. Consulte o guia de integração.' });
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    req.session.google = { state, nonce, verifier, linkingUser, expires: Date.now() + 600000 };
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    const url = oauth.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
    // A API entrega o destino para o frontend fazer uma navegação, não um fetch ao Google.
    if (req.isApi) return res.json({ autorizacaoUrl: url });
    res.redirect(url);
  };
  router.get('/auth/google', (req, res) => begin(req, res));
  router.post('/auth/google/vincular', async (req, res) => {
    const { rows: [user] } = await db.query('SELECT id, senha_hash FROM usuario WHERE id = $1 AND ativo', [req.session.userId ?? null]);
    if (!user) return res.status(401).render('erro', { mensagem: 'Entre na conta antes de vincular o Google.' });
    if (typeof req.body.senha !== 'string' || req.body.senha.length > 256 || !await verifyPassword(req.body.senha, user.senha_hash)) {
      return res.status(401).render('erro', { mensagem: 'Confirme a senha original da conta para vincular o Google.' });
    }
    return begin(req, res, user.id);
  });
  router.get('/auth/google/callback', async (req, res) => {
    const pending = req.session.google;
    delete req.session.google;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    if (!oauth || !pending || pending.expires < Date.now() || typeof req.query.state !== 'string' || req.query.state !== pending.state || typeof req.query.code !== 'string') {
      return res.status(400).render('erro', { mensagem: 'Retorno Google inválido ou expirado. Inicie o acesso novamente.' });
    }
    let identity;
    try {
      const { tokens } = await oauth.getToken({ code: req.query.code, codeVerifier: pending.verifier });
      const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: config.id });
      identity = ticket.getPayload();
      if (!identity?.sub || identity.nonce !== pending.nonce || identity.email_verified !== true) throw new Error('Identidade inválida');
    } catch {
      return res.status(401).render('erro', { mensagem: 'Não foi possível validar o acesso Google. Tente novamente.' });
    }
    let user;
    if (pending.linkingUser) {
      if (req.session.userId !== pending.linkingUser) return res.status(401).render('erro', { mensagem: 'A sessão de vinculação mudou. Entre novamente.' });
      try {
        ({ rows: [user] } = await db.query(`UPDATE usuario SET google_sub = $1 WHERE id = $2 AND ativo AND (google_sub IS NULL OR google_sub = $1) RETURNING id, perfil`, [identity.sub, pending.linkingUser]));
      } catch (error) {
        if (error.code !== '23505') throw error;
        return res.status(409).render('erro', { mensagem: 'Esta identidade Google já está vinculada a outra conta.' });
      }
    } else {
      ({ rows: [user] } = await db.query('SELECT id, perfil FROM usuario WHERE google_sub = $1 AND ativo', [identity.sub]));
    }
    if (!user) return res.status(403).render('erro', { mensagem: 'Google não vinculado a uma conta ativa. Entre com telefone e senha e vincule a conta.' });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id;
    req.session.csrf = randomBytes(32).toString('hex');
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(303, user.perfil === 'GESTOR' ? '/unidades' : '/cliente/agendamentos');
  });
  return router;
}
