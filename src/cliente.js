import { coordenadas, distanciaKm } from './localizacao.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { hashPassword } from './password.js';

const id = value => typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value);
const date = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const reject = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const ids = value => {
  if (!Array.isArray(value) || !value.length || value.length > 20 || value.some(v => !id(v))) reject('Envie de 1 a 20 serviços, sem IDs inválidos.');
  return [...new Set(value)];
};
const cents = value => {
  const [a, b = ''] = value.split('.');
  return BigInt(a) * 100n + BigInt(b.padEnd(2, '0'));
};
const money = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;

export function createCustomerRouter(db) {
  const router = Router();
  router.use((req, res, next) => {
    if (!/^\/(cadastro|cliente)(\/|$)/.test(req.path)) return next('router');
    if (!req.isApi && !['/cadastro', '/cliente', '/cliente/agendamentos'].includes(req.path)) return res.status(404).json({ erro: 'Utilize /api para esta operação do cliente.' });
    next();
  });
  const signupLimit = rateLimit({ windowMs: 15 * 60000, limit: 10, handler: (req, res) => res.status(429).render('erro', { mensagem: 'Muitas tentativas de cadastro. Aguarde 15 minutos.' }) });
  router.get('/cadastro', (req, res) => res.render('cadastro', { erro: '' }));
  router.post('/cadastro', signupLimit, async (req, res) => {
    const { nome, telefone, senha } = req.body;
    const fail = (mensagem, status = 400) => req.isApi ? res.status(status).json({ erro: mensagem }) : res.status(status).render('cadastro', { erro: mensagem });
    if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 120 || typeof telefone !== 'string' || !/^\d{10,11}$/.test(telefone) || typeof senha !== 'string' || senha.length < 12 || senha.length > 256) return fail('Informe nome, telefone com DDD (10 ou 11 dígitos) e senha de 12 a 256 caracteres.');
    try {
      await db.query("INSERT INTO usuario (nome,telefone,senha_hash,perfil) VALUES ($1,$2,$3,'CLIENTE')", [nome.trim(), telefone, await hashPassword(senha)]);
    } catch (error) {
      if (error.code === '23505') return fail('Não foi possível cadastrar com esse telefone. Se já tem conta, faça login.', 409);
      throw error;
    }
    if (req.isApi) return res.status(201).json({ mensagem: 'Conta de cliente criada. Entre com telefone e senha.', proximaRota: '/login' });
    res.redirect(303, '/login');
  });
  router.use('/cliente', async (req, res, next) => {
    const { rows: [user] } = await db.query("SELECT id,nome FROM usuario WHERE id=$1 AND ativo AND perfil='CLIENTE'", [req.session.userId ?? null]);
    if (!user) {
      if (!req.isApi && !req.session.userId) return res.redirect(303, '/login');
      reject('Entre com uma conta de cliente ativa.', req.session.userId ? 403 : 401);
    }
    res.locals.clienteNome = user.nome;
    req.customerId = user.id;
    next();
  });
  router.get('/cliente', (req, res) => res.redirect(303, '/cliente/agendamentos'));
  router.get('/cliente/servicos', async (req, res) => res.json({ servicos: (await db.query(`SELECT s.id,s.nome,o.unidade_id,o.preco,o.duracao_minutos FROM servico s JOIN oferta_servico o ON o.servico_id=s.id JOIN unidade u ON u.id=o.unidade_id WHERE s.ativo AND o.ativa AND u.ativa ORDER BY s.id,o.unidade_id`)).rows }));
  router.get('/cliente/unidades', async (req, res) => {
    const services = ids(typeof req.query.servicos === 'string' ? req.query.servicos.split(',') : []);
    const { rows } = await db.query(`SELECT u.id,u.nome,u.endereco,u.latitude,u.longitude FROM unidade u JOIN oferta_servico o ON o.unidade_id=u.id JOIN servico s ON s.id=o.servico_id WHERE u.ativa AND o.ativa AND s.ativo AND s.id=ANY($1::bigint[]) GROUP BY u.id HAVING count(DISTINCT s.id)=$2 ORDER BY u.nome`, [services, services.length]);
    const origem = coordenadas(req.query.latitude, req.query.longitude);
    const unidades = rows.map(row => ({ ...row, distanciaKm: distanciaKm(origem, row) }));
    if (origem) unidades.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity) || a.nome.localeCompare(b.nome));
    res.json({ unidades, criterio: origem ? 'distancia_em_linha_reta' : 'nome' });
  });

  const summary = async (client, unit, services) => {
    const { rows } = await client.query(`SELECT o.id AS oferta_id,s.id AS servico_id,s.nome,o.preco,o.duracao_minutos FROM oferta_servico o JOIN servico s ON s.id=o.servico_id JOIN unidade u ON u.id=o.unidade_id WHERE o.unidade_id=$1 AND s.id=ANY($2::bigint[]) AND o.ativa AND s.ativo AND u.ativa ORDER BY s.id FOR SHARE OF o,s,u`, [unit, services]);
    if (rows.length !== services.length) reject('A unidade não oferece todos os serviços selecionados.');
    const duration = rows.reduce((sum, row) => sum + row.duracao_minutos, 0);
    if (duration > 1440) reject('A duração do atendimento excede um dia.');
    return { itens: rows, duracaoMinutos: duration, valorTotal: money(rows.reduce((sum, row) => sum + cents(row.preco), 0n)) };
  };
  const available = async (client, unit, services, day, start, duration, professional = null, customer = null) => {
    const { rows } = await client.query(`WITH janela AS (SELECT ($3::date+$4::time)::timestamp AS inicio, ($3::date+$4::time+($5::int * interval '1 minute'))::timestamp AS fim)
      SELECT v.id,v.profissional_id,p.nome,j.inicio,j.fim FROM vinculo_profissional_unidade v JOIN profissional p ON p.id=v.profissional_id CROSS JOIN janela j
      WHERE v.unidade_id=$1 AND v.ativo AND p.ativo AND ($6::bigint IS NULL OR p.id=$6)
        AND j.inicio > (now() AT TIME ZONE 'America/Bahia') AND j.inicio::date=j.fim::date
        AND (SELECT count(*) FROM profissional_servico ps WHERE ps.profissional_id=p.id AND ps.servico_id=ANY($2::bigint[]))=cardinality($2::bigint[])
        AND EXISTS(SELECT 1 FROM turno_trabalho t WHERE t.vinculo_id=v.id AND t.dia_semana=extract(isodow FROM j.inicio) AND t.hora_inicio<=j.inicio::time AND t.hora_fim>=j.fim::time)
        AND NOT EXISTS(SELECT 1 FROM pausa_trabalho pa JOIN turno_trabalho t ON t.id=pa.turno_id WHERE t.vinculo_id=v.id AND t.dia_semana=extract(isodow FROM j.inicio) AND pa.hora_inicio<j.fim::time AND pa.hora_fim>j.inicio::time)
        AND NOT EXISTS(SELECT 1 FROM bloqueio_agenda b WHERE b.vinculo_id=v.id AND b.data=j.inicio::date AND (b.hora_inicio IS NULL OR (b.hora_inicio<j.fim::time AND b.hora_fim>j.inicio::time)))
        AND NOT EXISTS(SELECT 1 FROM agendamento a JOIN vinculo_profissional_unidade av ON av.id=a.vinculo_id WHERE a.status<>'CANCELADO' AND (av.profissional_id=p.id OR a.cliente_id=$7::bigint OR EXISTS(SELECT 1 FROM item_agendamento i WHERE i.agendamento_id=a.id AND i.profissional_id=p.id)) AND a.inicio<j.fim AND a.fim>j.inicio)
      ORDER BY p.id`, [unit, services, day, start, duration, professional, customer]);
    return rows;
  };
  router.get('/cliente/disponibilidade', async (req, res) => {
    const services = ids(typeof req.query.servicos === 'string' ? req.query.servicos.split(',') : []);
    if (!id(req.query.unidade) || !date(req.query.data) || (req.query.profissional && !id(req.query.profissional))) reject('Informe unidade, serviços, data e profissional válido ou deixe sem preferência.');
    const info = await summary(db, req.query.unidade, services);
    const slots = [];
    for (let minute=0; minute<1440; minute+=15) {
      const hour = `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
      const staff = await available(db, req.query.unidade, services, req.query.data, hour, info.duracaoMinutos, req.query.profissional || null, req.customerId);
      if (staff.length) slots.push({ hora: hour, profissionais: staff.map(p => ({ id: p.profissional_id, nome: p.nome })) });
    }
    res.json({ ...info, horarios: slots });
  });
  const book = async (req, res, reserve) => {
    const { unidade, servicos, data: day, hora, profissional } = req.body;
    const services = ids(servicos);
    if (!id(unidade) || !date(day) || typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || (profissional && !id(profissional))) reject('Unidade, data, horário ou profissional inválidos.');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Ordem fixa: cliente, profissionais, depois catálogo; evita duas reservas simultâneas.
      await client.query('SELECT id FROM usuario WHERE id=$1 FOR UPDATE', [req.customerId]);
      await client.query(`SELECT p.id FROM profissional p WHERE p.id IN (SELECT profissional_id FROM vinculo_profissional_unidade WHERE unidade_id=$1) ORDER BY p.id FOR UPDATE`, [unidade]);
      const info = await summary(client, unidade, services);
      const staff = await available(client, unidade, services, day, hora, info.duracaoMinutos, profissional || null, req.customerId);
      if (!staff.length) reject('Horário indisponível. Consulte a agenda novamente.', 409);
      const selected = staff[0];
      if (!reserve) {
        await client.query('COMMIT');
        return res.json({ ...info, unidade, profissional: { id: selected.profissional_id, nome: selected.nome }, inicio: `${day}T${hora}:00` });
      }
      const { rows: [appointment] } = await client.query(`INSERT INTO agendamento (cliente_id,vinculo_id,inicio,fim,valor_total) VALUES ($1,$2,$3::date+$4::time,$3::date+$4::time+($5::int*interval '1 minute'),$6) RETURNING id,status`, [req.customerId, selected.id, day, hora, info.duracaoMinutos, info.valorTotal]);
      for (const item of info.itens) await client.query('INSERT INTO item_agendamento (agendamento_id,oferta_id,nome,preco,duracao_minutos,profissional_id) VALUES ($1,$2,$3,$4,$5,$6)', [appointment.id,item.oferta_id,item.nome,item.preco,item.duracao_minutos,selected.profissional_id]);
      await client.query('COMMIT');
      res.status(201).json({ agendamento: appointment, ...info });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  };
  router.post('/cliente/resumo', (req, res) => book(req, res, false));
  router.post('/cliente/agendamentos', (req, res) => book(req, res, true));
  router.get('/cliente/agendamentos', async (req, res) => {
    const { rows } = await db.query(`SELECT a.id,a.origem,to_char(a.inicio,'YYYY-MM-DD"T"HH24:MI:SS') AS inicio,to_char(a.fim,'YYYY-MM-DD"T"HH24:MI:SS') AS fim,a.status,a.valor_total,u.nome AS unidade,p.nome AS profissional,
      COALESCE((SELECT json_agg(json_build_object('nome',i.nome,'preco',i.preco::text,'tipo',i.tipo,'profissionalId',i.profissional_id::text,'responsavel',(SELECT nome FROM profissional WHERE id=i.profissional_id))) FROM item_agendamento i WHERE i.agendamento_id=a.id),'[]'::json) AS itens
      FROM agendamento a JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id JOIN unidade u ON u.id=v.unidade_id JOIN profissional p ON p.id=v.profissional_id WHERE a.cliente_id=$1 ORDER BY a.inicio DESC`, [req.customerId]);
    if (!req.isApi) return res.render('cliente', { agendamentos: rows });
    res.json({ agendamentos: rows });
  });
  router.post('/cliente/agendamentos/:id/cancelar', async (req, res) => {
    if (!id(req.params.id)) reject('Agendamento inválido.');
    const { rowCount } = await db.query("UPDATE agendamento SET status='CANCELADO' WHERE id=$1 AND cliente_id=$2 AND status='CONFIRMADO' AND inicio > (now() AT TIME ZONE 'America/Bahia')", [req.params.id, req.customerId]);
    if (!rowCount) reject('Agendamento não encontrado ou não pode ser cancelado.', 409);
    res.json({ mensagem: 'Agendamento cancelado; horário liberado.' });
  });
  return router;
}
