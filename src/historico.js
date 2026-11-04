import { Router } from 'express';

export function createHistoryRouter(db) {
  const router = Router();
  const id = value => typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value);
  const invalid = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const extrasValidos = extras => {
    if (!Array.isArray(extras) || extras.length > 20 || extras.some(e => !e || typeof e.nome !== 'string' || !e.nome.trim() || e.nome.length > 120 || typeof e.preco !== 'string' || !/^\d{1,6}\.\d{2}$/.test(e.preco) || (e.profissional !== undefined && !id(e.profissional)))) invalid('Adicionais inválidos. Informe nome, preco decimal e profissional opcional.');
    return extras;
  };
  const addExtras = async (client, appointment, extras) => {
    for (const extra of extras) {
      const professional = extra.profissional ?? appointment.profissional_id;
      const { rowCount } = await client.query(`SELECT p.id FROM profissional p JOIN vinculo_profissional_unidade v ON v.profissional_id=p.id
        WHERE p.id=$1 AND p.ativo AND v.unidade_id=$2 AND v.ativo FOR SHARE OF p,v`, [professional, appointment.unidade_id]);
      if (!rowCount) invalid('Responsável do adicional precisa estar ativo e vinculado à unidade.');
      const conflict = await client.query(`SELECT a.id FROM agendamento a JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id
        WHERE a.id<>$1 AND a.status<>'CANCELADO' AND a.inicio<$3::timestamp AND a.fim>$2::timestamp AND
        (v.profissional_id=$4 OR EXISTS(SELECT 1 FROM item_agendamento i WHERE i.agendamento_id=a.id AND i.profissional_id=$4))`, [appointment.id,appointment.inicio,appointment.fim,professional]);
      if (conflict.rowCount) invalid('Responsável do adicional tem outro atendimento no período.', 409);
      await client.query("INSERT INTO item_agendamento (agendamento_id,nome,preco,duracao_minutos,tipo,profissional_id) VALUES ($1,$2,$3,0,'ADICIONAL',$4)", [appointment.id, extra.nome.trim(), extra.preco, professional]);
    }
  };
  const finish = async (client, appointmentId) => {
    const { rows: [result] } = await client.query(`WITH total AS (SELECT coalesce(sum(preco),0) AS valor FROM item_agendamento WHERE agendamento_id=$1)
      UPDATE agendamento a SET status='CONCLUIDO',valor_total=total.valor FROM total WHERE a.id=$1 AND total.valor<=99999999.99
      RETURNING a.id,a.status,a.origem,a.valor_total`, [appointmentId]);
    if (!result) invalid('Valor total excede o limite de R$ 99.999.999,99.');
    return result;
  };
  router.get('/clientes', async (req, res) => {
    if (typeof req.query.busca !== 'string' || req.query.busca.trim().length < 2 || req.query.busca.length > 120) invalid('Informe busca com 2 a 120 caracteres.');
    const { rows } = await db.query("SELECT id,nome,telefone FROM usuario WHERE perfil='CLIENTE' AND ativo AND (strpos(lower(nome),lower($1))>0 OR strpos(telefone,$1)>0) ORDER BY nome LIMIT 50", [req.query.busca.trim()]);
    res.json({ clientes: rows });
  });
  router.post('/atendimentos/avulso', async (req, res) => {
    if (!req.isApi) {
      req.body.servicos = Array.isArray(req.body.servicos) ? req.body.servicos : req.body.servicos ? [req.body.servicos] : [];
      if (typeof req.body.inicio === 'string' && req.body.inicio.length === 16) req.body.inicio += ':00';
      if (typeof req.body.extra_preco === 'string' && /^\d{1,6}([.,]\d{1,2})?$/.test(req.body.extra_preco)) {
        const [inteiro, fracao = ''] = req.body.extra_preco.replace(',', '.').split('.');
        req.body.extra_preco = inteiro + '.' + fracao.padEnd(2, '0');
      }
      req.body.adicionais = req.body.extra_nome || req.body.extra_preco
        ? [{ nome: req.body.extra_nome, preco: req.body.extra_preco, ...(req.body.extra_profissional ? { profissional: req.body.extra_profissional } : {}) }] : [];
    }
    const { cliente, unidade, profissional, inicio, servicos } = req.body;
    const extras = extrasValidos(req.body.adicionais ?? []);
    if (![cliente, unidade, profissional].every(id) || typeof inicio !== 'string' || !/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:00$/.test(inicio)
      || !Number.isFinite(Date.parse(inicio+'Z')) || new Date(inicio+'Z').toISOString().slice(0,19) !== inicio
      || !Array.isArray(servicos) || !servicos.length || servicos.length > 20 || servicos.some(s => !id(s)) || new Set(servicos).size !== servicos.length) invalid('Informe cliente, unidade, profissional, início válido e de 1 a 20 serviços distintos.');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (!(await client.query("SELECT id FROM usuario WHERE id=$1 AND perfil='CLIENTE' AND ativo FOR UPDATE", [cliente])).rowCount) invalid('Cliente ativo não encontrado.');
      // Mesma ordem da reserva: cliente, profissionais e catálogo.
      const responsaveis = [...new Set([profissional, ...extras.map(e => e.profissional ?? profissional)])];
      await client.query('SELECT id FROM profissional WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [responsaveis]);
      const { rows: [link] } = await client.query(`SELECT v.id FROM vinculo_profissional_unidade v JOIN profissional p ON p.id=v.profissional_id
        WHERE v.unidade_id=$1 AND p.id=$2 AND v.ativo AND p.ativo FOR SHARE OF v`, [unidade, profissional]);
      if (!link) invalid('Profissional ativo não vinculado à unidade.');
      const { rows: offers } = await client.query(`SELECT o.id,s.nome,o.preco,o.duracao_minutos FROM oferta_servico o JOIN servico s ON s.id=o.servico_id JOIN unidade u ON u.id=o.unidade_id
        WHERE o.unidade_id=$1 AND s.id=ANY($2::bigint[]) AND o.ativa AND s.ativo AND u.ativa
        AND EXISTS(SELECT 1 FROM profissional_servico ps WHERE ps.profissional_id=$3 AND ps.servico_id=s.id) ORDER BY s.id FOR SHARE OF o,s,u`, [unidade,servicos,profissional]);
      if (offers.length !== servicos.length) invalid('Unidade/profissional não oferecem todos os serviços ativos.');
      const duration = offers.reduce((sum, item) => sum + item.duracao_minutos, 0);
      if (duration > 1440) invalid('Atendimento excede um dia.');
      const { rows: [interval] } = await client.query(`SELECT to_char($1::timestamp,'YYYY-MM-DD"T"HH24:MI:SS') AS inicio, to_char($1::timestamp+($2::int*interval '1 minute'),'YYYY-MM-DD"T"HH24:MI:SS') AS fim,
        $1::timestamp+($2::int*interval '1 minute') <= (now() AT TIME ZONE 'America/Bahia') AS realizado,
        $1::date=($1::timestamp+($2::int*interval '1 minute'))::date AS mesmo_dia`, [inicio,duration]);
      if (!interval.realizado || !interval.mesmo_dia) invalid('Registre somente atendimento já realizado, com início e fim no mesmo dia.');
      const { rowCount: conflicts } = await client.query(`SELECT a.id FROM agendamento a JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id
        WHERE a.status<>'CANCELADO' AND a.inicio<$2::timestamp AND a.fim>$1::timestamp AND (a.cliente_id=$3 OR v.profissional_id=ANY($4::bigint[]) OR
        EXISTS(SELECT 1 FROM item_agendamento i WHERE i.agendamento_id=a.id AND i.profissional_id=ANY($4::bigint[])))`, [interval.inicio,interval.fim,cliente,responsaveis]);
      if (conflicts) invalid('Há atendimento ou reserva conflitante para cliente ou responsável.', 409);
      const { rows: [appointment] } = await client.query(`INSERT INTO agendamento(cliente_id,vinculo_id,inicio,fim,valor_total,status,origem)
        VALUES ($1,$2,$3,$4,0,'CONCLUIDO','AVULSO') RETURNING id`, [cliente,link.id,interval.inicio,interval.fim]);
      for (const item of offers) await client.query('INSERT INTO item_agendamento(agendamento_id,oferta_id,nome,preco,duracao_minutos,profissional_id) VALUES ($1,$2,$3,$4,$5,$6)', [appointment.id,item.id,item.nome,item.preco,item.duracao_minutos,profissional]);
      await addExtras(client, { ...appointment, ...interval, id: appointment.id, unidade_id: unidade, profissional_id: profissional }, extras);
      const result = await finish(client, appointment.id);
      await client.query('COMMIT');
      if (!req.isApi) return res.redirect(303, '/gestao/historico');
      res.status(201).json({ atendimento: result });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  router.get('/historico', async (req, res) => {
    const { cliente, unidade, inicio, fim } = req.query;
    if ([cliente, unidade].some(v => v !== undefined && (typeof v !== 'string' || !/^[1-9]\d{0,17}$/.test(v)))) return res.status(400).json({ erro: 'Filtro de cliente ou unidade inválido.' });
    const validDate = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
    if ((inicio && !validDate(inicio)) || (fim && !validDate(fim)) || (inicio && fim && inicio > fim)) return res.status(400).json({ erro: 'Intervalo de datas inválido.' });
    const { rows } = await db.query(`SELECT a.id,a.cliente_id,c.nome AS cliente,u.nome AS unidade,p.nome AS profissional,a.status,a.origem,a.valor_total,
      to_char(a.inicio,'YYYY-MM-DD"T"HH24:MI:SS') AS inicio,to_char(a.fim,'YYYY-MM-DD"T"HH24:MI:SS') AS fim,
      COALESCE((SELECT json_agg(json_build_object('nome',i.nome,'preco',i.preco::text,'tipo',i.tipo,'profissionalId',i.profissional_id::text,'responsavel',(SELECT nome FROM profissional WHERE id=i.profissional_id))) FROM item_agendamento i WHERE i.agendamento_id=a.id),'[]'::json) AS itens
      FROM agendamento a JOIN usuario c ON c.id=a.cliente_id JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id JOIN unidade u ON u.id=v.unidade_id JOIN profissional p ON p.id=v.profissional_id
      WHERE ($1::bigint IS NULL OR a.cliente_id=$1) AND ($2::bigint IS NULL OR u.id=$2) AND ($3::date IS NULL OR a.inicio::date >= $3) AND ($4::date IS NULL OR a.inicio::date <= $4) ORDER BY a.inicio DESC LIMIT 500`, [cliente ?? null,unidade ?? null,inicio ?? null,fim ?? null]);
    if (!req.isApi) {
      const { rows: clientes } = await db.query("SELECT id,nome FROM usuario WHERE perfil='CLIENTE' AND ativo ORDER BY nome LIMIT 100");
      const { rows: unidades } = await db.query('SELECT id,nome FROM unidade WHERE ativa ORDER BY nome');
      const { rows: profissionais } = await db.query('SELECT id,nome FROM profissional WHERE ativo ORDER BY nome');
      const { rows: servicos } = await db.query('SELECT id,nome FROM servico WHERE ativo ORDER BY nome');
      return res.render('historico', { atendimentos: rows, clientes, unidades, profissionais, servicos });
    }
    res.json({ atendimentos: rows, limite: 500 });
  });
  router.post('/atendimentos/:id/concluir', async (req, res) => {
    if (!/^[1-9]\d{0,17}$/.test(req.params.id)) return res.status(400).json({ erro: 'Atendimento inválido.' });
    const extras = extrasValidos(req.body.adicionais ?? []);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: [appointment] } = await client.query(`SELECT a.id,v.profissional_id,v.unidade_id,
        to_char(a.inicio,'YYYY-MM-DD"T"HH24:MI:SS') AS inicio,to_char(a.fim,'YYYY-MM-DD"T"HH24:MI:SS') AS fim
        FROM agendamento a JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id WHERE a.id=$1 AND a.status='CONFIRMADO' AND a.fim <= (now() AT TIME ZONE 'America/Bahia') FOR UPDATE OF a`, [req.params.id]);
      if (!appointment) {
        await client.query('ROLLBACK');
        return res.status(409).json({ erro: 'Atendimento não encontrado, futuro ou já encerrado.' });
      }
      await client.query('SELECT id FROM profissional WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [[...new Set([appointment.profissional_id, ...extras.map(e => e.profissional ?? appointment.profissional_id)])]]);
      await addExtras(client, appointment, extras);
      await finish(client, appointment.id);
      await client.query('COMMIT');
      res.json({ mensagem: 'Atendimento concluído e registrado no histórico.' });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  return router;
}
