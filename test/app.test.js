import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/password.js';

test('senha recebe salt e verifica sem salvar texto puro', async () => {
  const hash = await hashPassword('senha de teste');
  assert.notEqual(hash, await hashPassword('senha de teste'));
  assert.equal(await verifyPassword('senha de teste', hash), true);
  assert.equal(await verifyPassword('outra senha', hash), false);
  assert.equal(await verifyPassword('senha de teste', 'invalido'), false);
});

test('login, Unidades, Serviços e Profissionais com PostgreSQL real', async t => {
  const schema = `teste_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  let server;
  let testModeServer;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (testModeServer) await new Promise(resolve => testModeServer.close(resolve));
    await pool.end();
    assert.match(schema, /^teste_[a-f0-9]{16}$/);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  });
  await pool.query(await readFile(new URL('../database/001_estrutura.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../database/002_acesso.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../database/003_conflitos.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../database/004_agendamentos.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../database/005_complementos.sql', import.meta.url), 'utf8'));
  const password = 'SenhaDeTeste@2026';
  const { rows: [user] } = await pool.query(
    "INSERT INTO usuario (nome, telefone, senha_hash, perfil) VALUES ('Gestor teste', '71900000000', $1, 'GESTOR') RETURNING id",
    [await hashPassword(password)]
  );
  const app = createApp(pool, randomBytes(32).toString('hex'));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, body, json = false) => {
    const fields = new URLSearchParams();
    for (const [name, value] of Object.entries(body ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) fields.append(name, item);
    }
    const res = await fetch(base + path, {
      redirect: 'manual', method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(json ? { Accept: 'application/json' } : {}) },
      body: body ? fields : undefined
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { res, html: await res.text() };
  };
  const tokenFrom = html => html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  let page = await request('/unidades');
  assert.equal(page.res.headers.get('location'), '/login');
  assert.match(page.res.headers.get('set-cookie'), /HttpOnly/);
  assert.match(page.res.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await request('/servicos')).res.headers.get('location'), '/login');
  assert.equal((await request('/profissionais')).res.headers.get('location'), '/login');
  page = await request('/login');
  for (const asset of ['/style.css', '/app.js', '/logo.png']) {
    assert.equal((await request(asset)).res.status, 200);
  }
  let csrf = tokenFrom(page.html);
  assert.equal((await request('/login', { telefone: '71900000000', senha: password })).res.status, 403);
  assert.equal((await request('/login', { _csrf: 'á'.repeat(64), telefone: '71900000000', senha: password })).res.status, 403);
  assert.equal((await request('/login', { _csrf: csrf, telefone: '71900000000', senha: 'errada' })).res.status, 401);
  const oldCookie = cookie;
  assert.equal((await request('/login', { _csrf: csrf, telefone: '(71) 90000-0000', senha: password })).res.status, 303);
  assert.notEqual(cookie, oldCookie);
  page = await request('/unidades');
  csrf = tokenFrom(page.html);
  assert.match(page.html, /Nenhuma unidade cadastrada/);
  assert.equal((await request('/unidades', { _csrf: csrf, nome: '   ', endereco: 'Endereco', ativa: 'true' })).res.status, 400);
  assert.equal((await request('/unidades', { _csrf: csrf, nome: 'Valida', endereco: 'Endereco', ativa: 'sim' })).res.status, 400);
  assert.equal((await request('/unidades', { _csrf: csrf, nome: '<script>alert(1)</script>', endereco: "Rua ' teste", ativa: 'true' })).res.status, 303);
  const { rows: [unit] } = await pool.query('SELECT * FROM unidade');
  assert.equal(unit.endereco, "Rua ' teste");
  page = await request('/unidades');
  assert.match(page.html, /&lt;script&gt;/);
  assert.doesNotMatch(page.html, /<script>alert/);
  assert.match(page.html, /Unidade cadastrada/);
  assert.equal((await request(`/unidades/${unit.id}/editar`)).res.status, 200);
  assert.equal((await request(`/unidades/${unit.id}`, { _csrf: csrf, nome: 'Unidade editada', endereco: 'Endereco editado', ativa: 'true' })).res.status, 303);
  assert.equal((await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'false' })).res.status, 303);
  assert.equal((await pool.query('SELECT ativa FROM unidade')).rows[0].ativa, false);
  assert.equal((await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'true' })).res.status, 303);
  assert.equal((await pool.query('SELECT ativa FROM unidade')).rows[0].ativa, true);
  page = await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'false' }, true);
  assert.equal(page.res.status, 200);
  assert.equal(page.res.headers.get('location'), null);
  assert.deepEqual(JSON.parse(page.html), { ativo: false, mensagem: 'Unidade inativada.' });
  assert.equal((await pool.query('SELECT ativa FROM unidade')).rows[0].ativa, false);
  assert.equal((await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'true' }, true)).res.status, 200);
  assert.equal((await request(`/unidades/${unit.id}/situacao`, { _csrf: '0'.repeat(64), ativa: 'false' })).res.status, 403);
  assert.equal((await request('/unidades/abc/editar')).res.status, 404);
  assert.equal((await request('/unidades/999999999/editar')).res.status, 404);

  const { rows: [secondUnit] } = await pool.query("INSERT INTO unidade (nome, endereco) VALUES ('Segunda unidade', 'Endereco ficticio') RETURNING id");
  const serviceForm = {
    _csrf: csrf, nome: 'Corte', ativo: 'true', unidades: [unit.id, secondUnit.id],
    [`preco_${unit.id}`]: '35,50', [`duracao_${unit.id}`]: '30',
    [`preco_${secondUnit.id}`]: '40.00', [`duracao_${secondUnit.id}`]: '40'
  };
  assert.equal((await request('/servicos/novo')).res.status, 200);
  assert.equal((await request('/servicos', { ...serviceForm, unidades: [] })).res.status, 400);
  assert.equal((await request('/servicos', { ...serviceForm, [`preco_${unit.id}`]: '-1' })).res.status, 400);
  assert.equal((await request('/servicos', { ...serviceForm, [`duracao_${unit.id}`]: '0' })).res.status, 400);
  assert.equal((await pool.query('SELECT * FROM servico')).rowCount, 0);
  assert.equal((await request('/servicos', serviceForm)).res.status, 303);
  const { rows: [service] } = await pool.query('SELECT * FROM servico');
  assert.deepEqual((await pool.query('SELECT preco FROM oferta_servico ORDER BY unidade_id')).rows.map(o => o.preco), ['35.50', '40.00']);
  assert.equal((await request(`/servicos/${service.id}/editar`)).res.status, 200);
  assert.equal((await request(`/servicos/${service.id}`, { ...serviceForm, nome: 'Corte editado', unidades: [unit.id] })).res.status, 303);
  assert.equal((await pool.query('SELECT ativa FROM oferta_servico WHERE unidade_id = $1', [secondUnit.id])).rows[0].ativa, false);
  page = await request('/servicos');
  assert.match(page.html, /Corte editado/);
  assert.match(page.html, /35,50/);
  const professionalForm = {
    _csrf: csrf, nome: 'Profissional teste', foto_url: '', ativo: 'true',
    unidades: [unit.id, secondUnit.id], servicos: [service.id]
  };
  assert.equal((await request('/profissionais/novo')).res.status, 200);
  assert.equal((await request('/profissionais', { ...professionalForm, unidades: ['999999'] })).res.status, 400);
  assert.equal((await request('/profissionais', { ...professionalForm, servicos: [] })).res.status, 400);
  assert.equal((await request('/profissionais', { ...professionalForm, foto_url: 'javascript:alert(1)' })).res.status, 400);
  assert.equal((await pool.query('SELECT * FROM profissional')).rowCount, 0);
  assert.equal((await request('/profissionais', professionalForm)).res.status, 303);
  const { rows: [professional] } = await pool.query('SELECT * FROM profissional');
  const { rows: [oldLink] } = await pool.query('SELECT * FROM vinculo_profissional_unidade WHERE unidade_id = $1', [secondUnit.id]);
  await pool.query("INSERT INTO turno_trabalho (vinculo_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, 1, '09:00', '18:00')", [oldLink.id]);
  assert.equal((await request(`/profissionais/${professional.id}/editar`)).res.status, 200);
  assert.equal((await request(`/profissionais/${professional.id}`, { ...professionalForm, nome: 'Profissional editado', unidades: [unit.id] })).res.status, 303);
  assert.equal((await pool.query('SELECT ativo FROM vinculo_profissional_unidade WHERE id = $1', [oldLink.id])).rows[0].ativo, false);
  assert.equal((await pool.query('SELECT * FROM turno_trabalho WHERE vinculo_id = $1', [oldLink.id])).rowCount, 1);
  assert.equal((await request(`/profissionais/${professional.id}`, { ...professionalForm, nome: 'Nao salvar', servicos: ['999999'] })).res.status, 400);
  assert.equal((await pool.query('SELECT nome FROM profissional')).rows[0].nome, 'Profissional editado');
  page = await request('/profissionais');
  assert.match(page.html, /Profissional editado/);
  assert.match(page.html, /Corte editado/);
  for (const [path, id, table] of [['servicos', service.id, 'servico'], ['profissionais', professional.id, 'profissional']]) {
    assert.equal((await request(`/${path}/${id}/situacao`, { _csrf: csrf, ativo: 'false' })).res.status, 303);
    assert.equal((await pool.query(`SELECT ativo FROM ${table} WHERE id = $1`, [id])).rows[0].ativo, false);
    assert.equal((await request(`/${path}/${id}/situacao`, { _csrf: csrf, ativo: 'true' })).res.status, 303);
    assert.equal((await pool.query(`SELECT ativo FROM ${table} WHERE id = $1`, [id])).rows[0].ativo, true);
    page = await request(`/${path}/${id}/situacao`, { _csrf: csrf, ativo: 'false' }, true);
    assert.equal(page.res.status, 200);
    assert.equal(JSON.parse(page.html).ativo, false);
    assert.equal((await pool.query(`SELECT ativo FROM ${table} WHERE id = $1`, [id])).rows[0].ativo, false);
    assert.equal((await request(`/${path}/${id}/situacao`, { _csrf: csrf, ativo: 'true' }, true)).res.status, 200);
    assert.equal((await request(`/${path}/${id}/situacao`, { ativo: 'false' })).res.status, 403);
    assert.equal((await request(`/${path}/999999/editar`)).res.status, 404);
    assert.equal((await request(`/${path}/abc/editar`)).res.status, 404);
  }
  await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'false' });
  assert.equal((await request('/servicos', { ...serviceForm, unidades: [unit.id] })).res.status, 400);
  assert.equal((await request(`/servicos/${service.id}`, { ...serviceForm, unidades: [unit.id] })).res.status, 303);
  assert.equal((await request('/profissionais', { ...professionalForm, unidades: [unit.id] })).res.status, 400);
  assert.equal((await request(`/profissionais/${professional.id}`, { ...professionalForm, unidades: [unit.id] })).res.status, 303);
  await request(`/unidades/${unit.id}/situacao`, { _csrf: csrf, ativa: 'true' });
  await request(`/servicos/${service.id}/situacao`, { _csrf: csrf, ativo: 'false' });
  assert.equal((await request('/profissionais', professionalForm)).res.status, 400);
  assert.equal((await request(`/profissionais/${professional.id}`, { ...professionalForm, unidades: [unit.id] })).res.status, 303);
  await request(`/servicos/${service.id}/situacao`, { _csrf: csrf, ativo: 'true' });

  const beforeFailure = (await pool.query('SELECT nome FROM profissional')).rows[0].nome;
  await pool.query('ALTER TABLE profissional_servico ADD CONSTRAINT falha_simulada CHECK (false) NOT VALID');
  page = await request(`/profissionais/${professional.id}`, { ...professionalForm, nome: 'Nao persistir', unidades: [unit.id] });
  assert.equal(page.res.status, 500);
  assert.doesNotMatch(page.html, /falha_simulada|23514/);
  assert.equal((await pool.query('SELECT nome FROM profissional')).rows[0].nome, beforeFailure);
  assert.equal((await pool.query('SELECT * FROM profissional_servico WHERE profissional_id = $1', [professional.id])).rowCount, 1);
  await pool.query('ALTER TABLE profissional_servico DROP CONSTRAINT falha_simulada');

  const { rows: [scheduleLink] } = await pool.query('SELECT id FROM vinculo_profissional_unidade WHERE profissional_id = $1 AND unidade_id = $2', [professional.id, unit.id]);
  assert.equal((await request('/horarios')).res.status, 200);
  const schedule = { _csrf: csrf, vinculo: scheduleLink.id, tipo: 'turno', dias: ['2', '3'], inicio: '09:00', fim: '18:00' };
  assert.equal((await request('/horarios', { ...schedule, fim: '08:00' })).res.status, 400);
  assert.equal((await request('/horarios', schedule)).res.status, 303);
  assert.equal((await request('/horarios', schedule)).res.status, 400);
  const { rows: [shift] } = await pool.query('SELECT id FROM turno_trabalho WHERE vinculo_id = $1 AND dia_semana = 2', [scheduleLink.id]);
  const pause = { _csrf: csrf, vinculo: scheduleLink.id, tipo: 'pausa', turno: shift.id, descricao: 'Almoço', inicio: '12:00', fim: '13:00' };
  assert.equal((await request('/horarios', { ...pause, inicio: '08:00' })).res.status, 400);
  assert.equal((await request('/horarios', pause)).res.status, 303);
  assert.equal((await request('/horarios', pause)).res.status, 400);
  const block = { _csrf: csrf, vinculo: scheduleLink.id, tipo: 'bloqueio', descricao: 'Feriado', motivo: 'FERIADO', data: '2026-11-02', dia_inteiro: 'true' };
  assert.equal((await request('/horarios', { ...block, data: '2026-02-30' })).res.status, 400);
  assert.equal((await request('/horarios', block)).res.status, 303);
  assert.equal((await request('/horarios', block)).res.status, 400);
  assert.equal((await request('/horarios', { ...block, data: '2026-11-03', dia_inteiro: 'false', inicio: '15:00', fim: '16:00' })).res.status, 303);
  const parallel = await Promise.all([request('/horarios', { ...schedule, dias: ['5'] }), request('/horarios', { ...schedule, dias: ['5'] })]);
  assert.deepEqual(parallel.map(p => p.res.status).sort(), [303, 400]);
  await request(`/profissionais/${professional.id}`, professionalForm);
  assert.equal((await request('/horarios', { ...schedule, vinculo: oldLink.id, dias: ['2'] })).res.status, 400);
  const pageSchedule = await request('/horarios?vinculo=' + scheduleLink.id);
  assert.match(pageSchedule.html, /Almoço/);
  assert.match(pageSchedule.html, /02\/11\/2026/);
  assert.equal((await request('/horarios', { ...schedule, _csrf: '' })).res.status, 403);

  await pool.query("UPDATE usuario SET perfil = 'CLIENTE' WHERE id = $1", [user.id]);
  assert.equal((await request('/unidades')).res.status, 403);
  assert.equal((await request('/profissionais')).res.status, 403);
  assert.equal((await request('/servicos')).res.status, 403);
  await request('/sair', { _csrf: csrf });
  csrf = tokenFrom((await request('/login')).html);
  const clientLogin = await request('/login', { _csrf: csrf, telefone: '71900000000', senha: password });
  assert.equal(clientLogin.res.status, 303);
  assert.equal(clientLogin.res.headers.get('location'), '/cliente/agendamentos');
  csrf = tokenFrom((await request('/cliente/agendamentos')).html);
  await request('/sair', { _csrf: csrf });
  csrf = tokenFrom((await request('/login')).html);
  await pool.query("UPDATE usuario SET perfil = 'GESTOR', ativo = false WHERE id = $1", [user.id]);
  assert.equal((await request('/login', { _csrf: csrf, telefone: '71900000000', senha: password })).res.status, 401);
  await pool.query('UPDATE usuario SET ativo = true WHERE id = $1', [user.id]);
  assert.equal((await request('/login', { _csrf: csrf, telefone: '71900000000', senha: password })).res.status, 303);
  csrf = tokenFrom((await request('/unidades')).html);
  assert.equal((await request('/sair', { _csrf: csrf })).res.status, 303);
  assert.equal((await request('/unidades')).res.headers.get('location'), '/login');
  csrf = tokenFrom((await request('/login')).html);
  for (let i = 0; i < 16; i++) page = await request('/login', { _csrf: csrf, telefone: '71900000000', senha: 'errada' });
  assert.equal(page.res.status, 429);

  const testModeApp = createApp(pool, randomBytes(32).toString('hex'), { allowAnyPassword: true });
  testModeServer = testModeApp.listen(0, '127.0.0.1');
  await once(testModeServer, 'listening');
  const testBase = `http://127.0.0.1:${testModeServer.address().port}`;
  const testLogin = async (phone, senha) => {
    const login = await fetch(testBase + '/login');
    const html = await login.text();
    assert.match(html, /Modo de teste local/);
    const response = await fetch(testBase + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: tokenFrom(html), telefone: phone, senha })
    });
    await response.text();
    return response.status;
  };
  assert.equal(await testLogin('71900000000', 'qualquer-senha'), 303);
  assert.equal(await testLogin('71900000000', ''), 400);
  assert.equal(await testLogin('71911111111', 'qualquer-senha'), 401);
  await pool.query('UPDATE usuario SET ativo = false WHERE id = $1', [user.id]);
  assert.equal(await testLogin('71900000000', 'qualquer-senha'), 401);
  await pool.query("UPDATE usuario SET ativo = true, perfil = 'CLIENTE' WHERE id = $1", [user.id]);
  assert.equal(await testLogin('71900000000', 'qualquer-senha'), 303);
});
