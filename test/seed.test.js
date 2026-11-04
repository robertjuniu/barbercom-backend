import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import pg from 'pg';
import { seedContainer } from '../scripts/seed-container.js';
import { createApp } from '../src/app.js';

test('Seed Docker: repetição preserva cadastros e reservas; cliente consegue agendar com os exemplos', async t => {
  const schema = `teste_${randomBytes(8).toString('hex')}`;
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  await owner.query(`CREATE SCHEMA "${schema}"`);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.end();
    assert.match(schema, /^teste_[a-f0-9]{16}$/);
    await owner.query(`DROP SCHEMA "${schema}" CASCADE`);
    await owner.end();
  });
  for (const file of ['001_estrutura.sql','002_acesso.sql','003_conflitos.sql','004_agendamentos.sql','005_complementos.sql']) await db.query(await readFile(new URL('../database/'+file, import.meta.url), 'utf8'));
  const env = { ADMIN_PHONE:'71999990000', ADMIN_PASSWORD:'GestorDemo@2026', CLIENT_PHONE:'71999990001', CLIENT_PASSWORD:'ClienteDemo@2026' };
  await seedContainer(db, env);
  const counts = async () => (await db.query(`SELECT
    (SELECT count(*) FROM usuario)::int usuarios,
    (SELECT count(*) FROM unidade)::int unidades,
    (SELECT count(*) FROM profissional)::int profissionais,
    (SELECT count(*) FROM servico)::int servicos,
    (SELECT count(*) FROM turno_trabalho)::int turnos,
    (SELECT count(*) FROM pausa_trabalho)::int pausas`)).rows[0];
  assert.deepEqual(await counts(), { usuarios:2, unidades:3, profissionais:4, servicos:2, turnos:28, pausas:28 });
  const before = (await db.query('SELECT id,senha_hash FROM usuario ORDER BY id')).rows;
  await db.query("UPDATE unidade SET nome='Nome editado' WHERE id=(SELECT min(id) FROM unidade)");
  await Promise.all([seedContainer(db, env), seedContainer(db, { ...env, ADMIN_PASSWORD:'OutraSenha@2026' })]);
  assert.deepEqual((await db.query('SELECT id,senha_hash FROM usuario ORDER BY id')).rows, before);
  assert.equal((await db.query("SELECT count(*)::int n FROM unidade WHERE nome='Nome editado'")).rows[0].n,1);
  assert.equal((await counts()).turnos,28);
  await assert.rejects(seedContainer(db,{...env, CLIENT_PHONE:env.ADMIN_PHONE}));
  await assert.rejects(seedContainer(db,{...env, CLIENT_PHONE:env.ADMIN_PHONE, ADMIN_PHONE:'71999990002'}), /outro perfil/);
  assert.equal((await counts()).usuarios,2); // A conta anterior da transação também foi revertida.
  server = createApp(db, randomBytes(32).toString('hex')).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie='', csrf='';
  async function call(path, body) {
    const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
    if(r.headers.get('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0];
    const data=await r.json();if(data.csrf)csrf=data.csrf;
    return { status:r.status, data };
  }
  await call('/login');
  assert.equal((await call('/login',{telefone:env.CLIENT_PHONE,senha:env.CLIENT_PASSWORD})).status,200);
  assert.equal((await call('/sessao')).data.usuario.perfil,'CLIENTE');
  assert.equal((await call('/unidades')).status,403);
  const catalog=(await call('/cliente/servicos')).data.servicos;
  const corte=catalog.find(s=>s.nome==='Corte');
  const {rows:[future]}=await db.query("SELECT to_char((now() AT TIME ZONE 'America/Bahia')::date+7,'YYYY-MM-DD') dia");
  const slots=await call(`/cliente/disponibilidade?unidade=${corte.unidade_id}&servicos=${corte.id}&data=${future.dia}`);
  assert.equal(slots.status,200);assert.ok(slots.data.horarios.some(s=>s.hora==='10:00'));
  assert.ok(!slots.data.horarios.some(s=>s.hora==='12:00'));
  const booked=await call('/cliente/agendamentos',{unidade:corte.unidade_id,servicos:[corte.id],data:future.dia,hora:'10:00'});
  assert.equal(booked.status,201);
  await seedContainer(db,env);
  assert.equal((await call('/cliente/agendamentos')).data.agendamentos.length,1);
  await call(`/cliente/agendamentos/${booked.data.agendamento.id}/cancelar`,{});
  await call('/sair',{});await call('/login');
  assert.equal((await call('/login',{telefone:env.ADMIN_PHONE,senha:env.ADMIN_PASSWORD})).status,200);
  assert.equal((await call('/unidades')).data.unidades.length,3);
});
