import { readFile } from 'node:fs/promises';
import { hashPassword } from '../src/password.js';

export async function seedContainer(db, env = process.env) {
  const accounts = [
    ['Gestor de demonstração', env.ADMIN_PHONE, env.ADMIN_PASSWORD, 'GESTOR'],
    ['Cliente de demonstração', env.CLIENT_PHONE, env.CLIENT_PASSWORD, 'CLIENTE']
  ];
  for (const [, phone, password] of accounts) {
    if (!/^\d{10,11}$/.test(phone || '') || !password || password.length < 12 || password.length > 256) {
      throw new Error('Seed exige telefones de 10/11 dígitos e senhas de 12 a 256 caracteres.');
    }
  }
  if (accounts[0][1] === accounts[1][1]) throw new Error('Gestor e cliente precisam de telefones diferentes.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('barbercom-seed'))");
    for (const [name, phone, password, role] of accounts) {
      const existing = await client.query('SELECT perfil FROM usuario WHERE telefone=$1', [phone]);
      if (existing.rowCount && existing.rows[0].perfil !== role) throw new Error('Telefone de demonstração já pertence a outro perfil. Nenhuma conta foi alterada.');
      if (!existing.rowCount) await client.query('INSERT INTO usuario(nome,telefone,senha_hash,perfil) VALUES($1,$2,$3,$4)', [name, phone, await hashPassword(password), role]);
    }
    // Exemplos de catálogo e jornada são criados somente em banco sem unidades.
    if (!(await client.query('SELECT 1 FROM unidade LIMIT 1')).rowCount) {
      const units = JSON.parse(await readFile(new URL('../database/unidades-demonstracao.json', import.meta.url), 'utf8'));
      const { rows: services } = await client.query("INSERT INTO servico(nome) VALUES('Corte'),('Barba') RETURNING id,nome");
      for (const unit of units) {
        const { rows: [saved] } = await client.query('INSERT INTO unidade(nome,endereco,ativa,latitude,longitude) VALUES($1,$2,$3,$4,$5) RETURNING id', [unit.nome, unit.endereco, unit.ativa, unit.latitude, unit.longitude]);
        if (!unit.ativa) continue;
        for (const service of services) await client.query('INSERT INTO oferta_servico(unidade_id,servico_id,preco,duracao_minutos) VALUES($1,$2,$3,30)', [saved.id, service.id, service.nome === 'Corte' ? '35.00' : '25.00']);
        for (const name of ['Alex', 'Bruno']) {
          const { rows: [staff] } = await client.query('INSERT INTO profissional(nome) VALUES($1) RETURNING id', [`${name} (${unit.nome.replace('Unidade ', '')}, fictício)`]);
          const { rows: [link] } = await client.query('INSERT INTO vinculo_profissional_unidade(profissional_id,unidade_id) VALUES($1,$2) RETURNING id', [staff.id, saved.id]);
          for (const service of services) await client.query('INSERT INTO profissional_servico VALUES($1,$2)', [staff.id, service.id]);
          const { rows: shifts } = await client.query("INSERT INTO turno_trabalho(vinculo_id,dia_semana,hora_inicio,hora_fim) SELECT $1,d,'09:00','18:00' FROM generate_series(1,7) d RETURNING id", [link.id]);
          for (const shift of shifts) await client.query("INSERT INTO pausa_trabalho(turno_id,descricao,hora_inicio,hora_fim) VALUES($1,'Almoço','12:00','13:00')", [shift.id]);
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
