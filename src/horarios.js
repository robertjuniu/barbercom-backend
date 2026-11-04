import { Router } from 'express';

const idValid = value => typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value);
const timeValid = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function createScheduleRouter(db) {
  const router = Router();
  const render = async (req, res, erro = '', status = 200) => {
    const { rows: vinculos } = await db.query(`SELECT v.id, u.nome AS unidade, p.nome AS profissional
      FROM vinculo_profissional_unidade v JOIN unidade u ON u.id = v.unidade_id JOIN profissional p ON p.id = v.profissional_id
      WHERE v.ativo AND u.ativa AND p.ativo ORDER BY u.nome, p.nome`);
    const selected = vinculos.find(v => v.id === String(req.query.vinculo ?? req.body?.vinculo)) ?? vinculos[0];
    const { rows: turnos } = await db.query('SELECT * FROM turno_trabalho WHERE vinculo_id = $1 ORDER BY dia_semana, hora_inicio', [selected?.id ?? null]);
    const { rows: pausas } = await db.query(`SELECT p.*, t.dia_semana FROM pausa_trabalho p JOIN turno_trabalho t ON t.id = p.turno_id WHERE t.vinculo_id = $1 ORDER BY t.dia_semana, p.hora_inicio`, [selected?.id ?? null]);
    const { rows: bloqueios } = await db.query("SELECT *, to_char(data, 'DD/MM/YYYY') AS data_label FROM bloqueio_agenda WHERE vinculo_id = $1 ORDER BY data, hora_inicio", [selected?.id ?? null]);
    res.status(status).render('horarios', { vinculos, selected, turnos, pausas, bloqueios, erro, valores: req.method === 'POST' ? req.body : {}, dias: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] });
  };
  router.get('/', (req, res) => render(req, res));
  router.post('/', async (req, res) => {
    const body = req.body;
    const client = await db.connect();
    try {
      if (!idValid(body.vinculo)) bad('Selecione uma unidade e um profissional válidos.');
      await client.query('BEGIN');
      const { rows: [link] } = await client.query('SELECT * FROM vinculo_profissional_unidade WHERE id = $1', [body.vinculo]);
      if (!link) bad('Vínculo não encontrado.');
      // Serializa as gravações de agenda do mesmo profissional, inclusive em unidades diferentes.
      await client.query('SELECT id FROM profissional WHERE id = $1 FOR UPDATE', [link.profissional_id]);
      const { rowCount } = await client.query(`SELECT 1 FROM vinculo_profissional_unidade v JOIN unidade u ON u.id = v.unidade_id JOIN profissional p ON p.id = v.profissional_id WHERE v.id = $1 AND v.ativo AND u.ativa AND p.ativo FOR SHARE OF v, u`, [body.vinculo]);
      if (!rowCount) bad('O profissional e a unidade precisam estar ativos.');
      if ((await client.query("SELECT 1 FROM agendamento WHERE vinculo_id=$1 AND status='CONFIRMADO' AND fim > (now() AT TIME ZONE 'America/Bahia') LIMIT 1", [link.id])).rowCount) {
        throw Object.assign(new Error('Este vínculo possui reservas em aberto. Resolva os agendamentos antes de alterar sua jornada.'), { status: 409 });
      }
      if (!['turno', 'pausa', 'bloqueio'].includes(body.tipo)) bad('Tipo de horário inválido.');
      const tables = { turno: 'turno_trabalho', pausa: 'pausa_trabalho', bloqueio: 'bloqueio_agenda' };
      const editing = body.id !== undefined;
      if (editing) {
        if (!idValid(body.id)) bad('Registro inválido.');
        const query = body.tipo === 'pausa'
          ? 'SELECT p.id FROM pausa_trabalho p JOIN turno_trabalho t ON t.id = p.turno_id WHERE p.id = $1 AND t.vinculo_id = $2'
          : `SELECT id FROM ${tables[body.tipo]} WHERE id = $1 AND vinculo_id = $2`;
        if (!(await client.query(query, [body.id, link.id])).rowCount) bad('O registro não pertence ao vínculo selecionado.');
        if (body.remover === 'true') {
          if (body.tipo === 'turno' && (await client.query('SELECT 1 FROM pausa_trabalho WHERE turno_id = $1', [body.id])).rowCount) bad('Remova as pausas deste turno antes de remover o turno.');
          await client.query(`DELETE FROM ${tables[body.tipo]} WHERE id = $1`, [body.id]);
          await client.query('COMMIT');
          req.session.aviso = 'Horário removido.';
          return res.redirect(303, `/horarios?vinculo=${link.id}`);
        }
      }
      const fullDay = body.tipo === 'bloqueio' && body.dia_inteiro === 'true';
      if (!fullDay && (!timeValid(body.inicio) || !timeValid(body.fim) || body.inicio >= body.fim)) bad('Informe início e fim válidos, com o fim depois do início, no mesmo dia.');
      if (body.tipo === 'turno') {
        const days = body.dias === undefined ? [] : Array.isArray(body.dias) ? body.dias : [body.dias];
        if (!days.length || days.some(day => !/^[1-7]$/.test(day))) bad('Selecione pelo menos um dia da semana.');
        if (editing && new Set(days).size !== 1) bad('Edite um dia por turno.');
        if (editing && (await client.query('SELECT 1 FROM pausa_trabalho WHERE turno_id = $1 AND (hora_inicio < $2::time OR hora_fim > $3::time)', [body.id, body.inicio, body.fim])).rowCount) bad('O novo turno precisa conter suas pausas existentes.');
        for (const day of new Set(days)) {
          const { rowCount: conflicts } = await client.query(`SELECT 1 FROM turno_trabalho t JOIN vinculo_profissional_unidade v ON v.id = t.vinculo_id WHERE v.profissional_id = $1 AND v.ativo AND t.dia_semana = $2 AND t.hora_inicio < $4::time AND t.hora_fim > $3::time AND t.id <> COALESCE($5::bigint, -1)`, [link.profissional_id, day, body.inicio, body.fim, body.id ?? null]);
          if (conflicts) bad('Esse profissional já tem turno nesse intervalo, nesta ou em outra unidade.');
          if (editing) await client.query('UPDATE turno_trabalho SET dia_semana = $1, hora_inicio = $2, hora_fim = $3 WHERE id = $4', [day, body.inicio, body.fim, body.id]);
          else await client.query('INSERT INTO turno_trabalho (vinculo_id, dia_semana, hora_inicio, hora_fim) VALUES ($1,$2,$3,$4)', [link.id, day, body.inicio, body.fim]);
        }
      } else {
        const description = typeof body.descricao === 'string' ? body.descricao.trim() : '';
        if (!description || description.length > 120) bad('Informe uma descrição com até 120 caracteres.');
        if (body.tipo === 'pausa') {
          if (!idValid(body.turno)) bad('Selecione o turno da pausa.');
          const { rowCount: inside } = await client.query('SELECT 1 FROM turno_trabalho WHERE id = $1 AND vinculo_id = $2 AND hora_inicio <= $3::time AND hora_fim >= $4::time', [body.turno, link.id, body.inicio, body.fim]);
          if (!inside) bad('A pausa deve estar dentro do turno selecionado.');
          const { rowCount: conflicts } = await client.query('SELECT 1 FROM pausa_trabalho WHERE turno_id = $1 AND hora_inicio < $3::time AND hora_fim > $2::time AND id <> COALESCE($4::bigint, -1)', [body.turno, body.inicio, body.fim, body.id ?? null]);
          if (conflicts) bad('Essa pausa conflita com uma pausa existente.');
          if (editing) await client.query('UPDATE pausa_trabalho SET turno_id = $1, descricao = $2, hora_inicio = $3, hora_fim = $4 WHERE id = $5', [body.turno, description, body.inicio, body.fim, body.id]);
          else await client.query('INSERT INTO pausa_trabalho (turno_id, descricao, hora_inicio, hora_fim) VALUES ($1,$2,$3,$4)', [body.turno, description, body.inicio, body.fim]);
        } else {
          if (typeof body.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.data) || body.data.slice(0,4) < '1900' || body.data.slice(0,4) > '9999' || !Number.isFinite(Date.parse(body.data)) || new Date(body.data).toISOString().slice(0,10) !== body.data) bad('Informe uma data válida.');
          if (!['FERIADO', 'INDISPONIBILIDADE'].includes(body.motivo)) bad('Escolha feriado ou indisponibilidade.');
          const start = fullDay ? null : body.inicio;
          const end = fullDay ? null : body.fim;
          const { rowCount: conflicts } = await client.query(`SELECT 1 FROM bloqueio_agenda WHERE vinculo_id = $1 AND data = $2 AND (hora_inicio IS NULL OR $3::time IS NULL OR (hora_inicio < $4::time AND hora_fim > $3::time)) AND id <> COALESCE($5::bigint, -1)`, [link.id, body.data, start, end, body.id ?? null]);
          if (conflicts) bad('Já existe um bloqueio nessa data e intervalo.');
          if (editing) await client.query('UPDATE bloqueio_agenda SET data = $1, descricao = $2, tipo = $3, hora_inicio = $4, hora_fim = $5 WHERE id = $6', [body.data, description, body.motivo, start, end, body.id]);
          else await client.query('INSERT INTO bloqueio_agenda (vinculo_id, data, descricao, tipo, hora_inicio, hora_fim) VALUES ($1,$2,$3,$4,$5,$6)', [link.id, body.data, description, body.motivo, start, end]);
        }
      }
      await client.query('COMMIT');
      req.session.aviso = 'Horário cadastrado.';
      res.redirect(303, `/horarios?vinculo=${link.id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      if (![400,409].includes(error.status)) throw error;
      await render(req, res, error.message, error.status);
    } finally { client.release(); }
  });
  return router;
}
