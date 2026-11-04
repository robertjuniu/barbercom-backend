import { coordenadas } from './localizacao.js';
import { createPhotoRouter, sendPhoto } from './fotos.js';
import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './password.js';
import { createCatalogRouter } from './catalogo.js';
import { createScheduleRouter } from './horarios.js';
import { apiAdapter } from './api.js';
import { PostgresSessionStore } from './session-store.js';
import { createGoogleRouter } from './google.js';
import { createCustomerRouter } from './cliente.js';
import { createHistoryRouter } from './historico.js';

export function createApp(db, secret, { allowAnyPassword = false, demoGestor = false, google = null, frontendOrigin = null } = {}) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET precisa de pelo menos 32 caracteres.');
  if (process.env.NODE_ENV === 'production') throw new Error('Esta versao e local. Configure HTTPS e sessoes persistentes antes de publicar.');
  const app = express();
  if (frontendOrigin && new URL(frontendOrigin).origin !== frontendOrigin) throw new Error('FRONTEND_ORIGIN deve conter apenas origem, sem caminho ou barra final.');
  app.locals.allowAnyPassword = allowAnyPassword;
  app.locals.demoGestor = demoGestor;
  app.locals.googleEnabled = Boolean(google);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('../views', import.meta.url)));
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; frame-ancestors 'none'; form-action 'self'${google ? ' https://accounts.google.com' : ''}; base-uri 'none'`,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Cache-Control': 'no-store'
    });
    next();
  });
  app.use((req, res, next) => {
    if (frontendOrigin && req.get('Origin') === frontendOrigin) {
      res.vary('Origin');
      res.set({ 'Access-Control-Allow-Origin': frontendOrigin, 'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: '8kb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use(session({
    store: new PostgresSessionStore(db),
    secret, name: 'barbercom.sid', resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 }
  }));
  app.use(apiAdapter);
  app.use((req, res, next) => {
    req.session.csrf ??= randomBytes(32).toString('hex');
    res.locals.csrf = req.session.csrf;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const token = req.get('X-CSRF-Token') ?? req.body?._csrf;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
          !timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrf))) {
        return res.status(403).render('erro', { mensagem: 'Formulário expirado. Volte e recarregue a página.' });
      }
    }
    next();
  });
  app.get('/fotos/profissionais/:id', (req, res) => sendPhoto(db, req, res));
  app.use(createGoogleRouter(db, google));
  app.use(createCustomerRouter(db));
  app.get('/sessao', async (req, res) => {
    const { rows: [usuario] } = await db.query('SELECT id, nome, perfil FROM usuario WHERE id = $1 AND ativo', [req.session.userId ?? null]);
    res.json({ usuario: usuario ?? null, csrf: req.session.csrf });
  });
  app.get('/conta', async (req, res) => {
    const { rows: [user] } = await db.query('SELECT id,perfil FROM usuario WHERE id=$1 AND ativo', [req.session.userId ?? null]);
    if (!user) return res.redirect(303, '/login');
    res.render('conta', { voltar: user.perfil === 'GESTOR' ? '/unidades' : '/cliente/agendamentos' });
  });

  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 15, skipSuccessfulRequests: true,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).render('login', { erro: 'Muitas tentativas. Aguarde 15 minutos.', telefone: '' })
  });
  app.get('/', async (req, res) => {
    const { rows: [user] } = await db.query('SELECT perfil FROM usuario WHERE id=$1 AND ativo', [req.session.userId ?? null]);
    res.redirect(303, !user ? '/login' : user.perfil === 'GESTOR' ? '/unidades' : '/cliente/agendamentos');
  });
  app.get('/login', (req, res) => req.session.userId ? res.redirect('/') : res.render('login', { erro: '', telefone: '' }));
  app.post('/login', loginLimit, async (req, res) => {
    const telefone = typeof req.body.telefone === 'string' ? req.body.telefone.replace(/\D/g, '') : '';
    const senha = req.body.senha;
    const demonstration = demoGestor && req.body.acesso === 'gestor-demo';
    if (!(demonstration ? /^\d{1,25}$/ : /^\d{10,15}$/).test(telefone) || typeof senha !== 'string' || senha.length < 1 || senha.length > 256) {
      return res.status(400).render('login', { erro: 'Informe um telefone válido e a senha.', telefone });
    }
    const { rows: [user] } = demonstration
      ? await db.query("SELECT id, ativo, perfil FROM usuario WHERE perfil='GESTOR' AND ativo ORDER BY id LIMIT 1")
      : await db.query('SELECT id, senha_hash, ativo, perfil FROM usuario WHERE telefone = $1', [telefone]);
    const valid = demonstration || allowAnyPassword || await verifyPassword(senha, user?.senha_hash ?? await dummyHash);
    if (!valid || !user?.ativo) {
      return res.status(401).render('login', { erro: 'Telefone ou senha incorretos.', telefone });
    }
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id;
    req.session.csrf = randomBytes(32).toString('hex');
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(303, user.perfil === 'GESTOR' ? '/unidades' : '/cliente/agendamentos');
  });

  const requireGestor = async (req, res, next) => {
    if (!req.session.userId) return res.redirect(303, '/login');
    const { rows: [user] } = await db.query('SELECT nome, perfil FROM usuario WHERE id = $1 AND ativo', [req.session.userId]);
    if (!user) {
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie('barbercom.sid');
      return res.redirect(303, '/login');
    }
    if (user.perfil !== 'GESTOR') return res.status(403).render('erro', { mensagem: 'Esta operação é exclusiva do gestor.' });
    res.locals.usuario = user.nome;
    res.locals.aviso = req.session.aviso ?? '';
    delete req.session.aviso;
    next();
  };
  app.post('/sair', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('barbercom.sid');
    res.redirect(303, '/login');
  });
  app.use('/unidades', requireGestor);
  app.use(['/profissionais', '/servicos'], requireGestor);
  app.use('/profissionais', createPhotoRouter(db));
  app.use(createCatalogRouter(db));
  app.use('/horarios', requireGestor, createScheduleRouter(db));
  app.use('/gestao', requireGestor, createHistoryRouter(db));

  const renderUnits = async (res, { form = null, erro = '', status = 200 } = {}) => {
    const { rows: unidades } = await db.query('SELECT id, nome, endereco, ativa, latitude, longitude FROM unidade ORDER BY id');
    res.status(status).render('unidades', { unidades, form, erro, aviso: res.locals.aviso });
  };
  const findUnit = async (id, res) => {
    if (!/^[1-9]\d{0,17}$/.test(id)) {
      res.status(404).render('erro', { mensagem: 'Unidade não encontrada.' });
      return null;
    }
    const { rows: [unit] } = await db.query('SELECT id, nome, endereco, ativa, latitude, longitude FROM unidade WHERE id = $1', [id]);
    if (!unit) res.status(404).render('erro', { mensagem: 'Unidade não encontrada.' });
    return unit;
  };
  app.get('/unidades', (req, res) => renderUnits(res));
  app.get('/unidades/nova', (req, res) => renderUnits(res, { form: { nome: '', endereco: '', ativa: true } }));
  app.get('/unidades/:id/editar', async (req, res) => {
    const unit = await findUnit(req.params.id, res);
    if (unit) await renderUnits(res, { form: unit });
  });

  const saveUnit = async (req, res) => {
    const previous = req.params.id ? await findUnit(req.params.id, res) : null;
    if (req.params.id && !previous) return;
    const form = {
      id: req.params.id,
      nome: typeof req.body.nome === 'string' ? req.body.nome.trim() : '',
      endereco: typeof req.body.endereco === 'string' ? req.body.endereco.trim() : '',
      ativa: req.body.ativa === 'true'
    };
    if (!form.nome || form.nome.length > 120 || !form.endereco || form.endereco.length > 255 || !['true', 'false'].includes(req.body.ativa)) {
      return renderUnits(res, { form, status: 400, erro: 'Informe nome (até 120 caracteres), endereço (até 255) e situação válida.' });
    }
    let coords;
    try {
      coords = req.body.latitude === undefined && req.body.longitude === undefined && previous?.endereco === form.endereco
        ? previous : coordenadas(req.body.latitude, req.body.longitude);
    } catch (error) { return renderUnits(res, { form: { ...form, latitude: req.body.latitude, longitude: req.body.longitude }, status: 400, erro: error.message }); }
    if (form.id) {
      await db.query('UPDATE unidade SET nome=$1,endereco=$2,ativa=$3,latitude=$4,longitude=$5 WHERE id=$6', [form.nome, form.endereco, form.ativa, coords?.latitude ?? null, coords?.longitude ?? null, form.id]);
    } else {
      await db.query('INSERT INTO unidade (nome,endereco,ativa,latitude,longitude) VALUES ($1,$2,$3,$4,$5)', [form.nome, form.endereco, form.ativa, coords?.latitude ?? null, coords?.longitude ?? null]);
    }
    req.session.aviso = form.id ? 'Unidade atualizada.' : 'Unidade cadastrada.';
    res.redirect(303, '/unidades');
  };
  app.post('/unidades', saveUnit);
  app.post('/unidades/:id', saveUnit);
  app.post('/unidades/:id/situacao', async (req, res) => {
    if (!await findUnit(req.params.id, res)) return;
    if (!['true', 'false'].includes(req.body.ativa)) return res.status(400).render('erro', { mensagem: 'Situação inválida.' });
    await db.query('UPDATE unidade SET ativa = $1 WHERE id = $2', [req.body.ativa === 'true', req.params.id]);
    const mensagem = req.body.ativa === 'true' ? 'Unidade reativada.' : 'Unidade inativada.';
    if (req.accepts(['html', 'json']) === 'json') return res.json({ ativo: req.body.ativa === 'true', mensagem });
    req.session.aviso = mensagem;
    res.redirect(303, '/unidades');
  });
  app.use((req, res) => res.status(404).render('erro', { mensagem: 'Página não encontrada.' }));
  app.use((error, req, res, next) => {
    console.error('Falha na requisicao:', error.code ?? error.name);
    if (res.headersSent) return next(error);
    if (req.isApi || req.originalUrl.startsWith('/api/')) {
      const status = Number.isInteger(error.status) && ((error.status >= 400 && error.status < 500) || error.status === 503) ? error.status : 500;
      return res.status(status).json({ erro: status === 500 ? 'Não foi possível concluir. Tente novamente.' : error.message });
    }
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
    res.status(status).render('erro', { mensagem: status === 500 ? 'Não foi possível concluir. Tente novamente.' : error.message });
  });
  return app;
}
