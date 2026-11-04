import { pool } from '../src/db.js';
import { hashPassword } from '../src/password.js';
import { readFile, writeFile } from 'node:fs/promises';

const telefone = process.env.ADMIN_PHONE;
const senha = process.env.ADMIN_PASSWORD;
if (!/^\d{10,15}$/.test(telefone) || !senha || senha.length < 12 || senha.length > 256) {
  throw new Error('Defina ADMIN_PHONE e ADMIN_PASSWORD (12 a 256 caracteres) no .env.');
}
try {
  const result = await pool.query(
    "INSERT INTO usuario (nome, telefone, senha_hash, perfil) VALUES ($1, $2, $3, 'GESTOR') ON CONFLICT (telefone) DO NOTHING RETURNING id",
    ['Gestor de demonstracao', telefone, await hashPassword(senha)]
  );
  if (result.rowCount) {
    await writeFile('work/acesso-local.txt', `Acesso local BarberCom\nEndereco: http://127.0.0.1:${process.env.PORT || 3000}\nTelefone: ${telefone}\nSenha: ${senha}\n\nConta local de demonstracao. Nao use dados reais.\n`, { mode: 0o600 });
  }
  if (!(await pool.query('SELECT 1 FROM unidade LIMIT 1')).rowCount) {
    const unidades = JSON.parse(await readFile(new URL('../database/unidades-demonstracao.json', import.meta.url), 'utf8'));
    for (const unidade of unidades) await pool.query('INSERT INTO unidade (nome,endereco,ativa,latitude,longitude) VALUES ($1,$2,$3,$4,$5)',
      [unidade.nome, unidade.endereco, unidade.ativa, unidade.latitude, unidade.longitude]);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await client.query('SELECT 1 FROM servico LIMIT 1')).rowCount) {
      await client.query(`WITH novos AS (
        INSERT INTO servico (nome) VALUES ('Corte'), ('Barba') RETURNING id, nome
      ) INSERT INTO oferta_servico (unidade_id, servico_id, preco, duracao_minutos)
        SELECT u.id, s.id, CASE WHEN s.nome = 'Corte' THEN 35.00 ELSE 25.00 END, 30
        FROM unidade u CROSS JOIN novos s WHERE u.ativa`);
    }
    if (!(await client.query('SELECT 1 FROM profissional LIMIT 1')).rowCount &&
        (await client.query('SELECT 1 FROM unidade WHERE ativa LIMIT 1')).rowCount &&
        (await client.query('SELECT 1 FROM servico WHERE ativo LIMIT 1')).rowCount) {
      const { rows: [professional] } = await client.query("INSERT INTO profissional (nome) VALUES ('Profissional de demonstração') RETURNING id");
      await client.query('INSERT INTO vinculo_profissional_unidade (profissional_id, unidade_id) SELECT $1, id FROM unidade WHERE ativa', [professional.id]);
      await client.query('INSERT INTO profissional_servico (profissional_id, servico_id) SELECT $1, id FROM servico WHERE ativo', [professional.id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  console.log('Dados de demonstracao preparados. O acesso esta em work/acesso-local.txt. Senhas existentes nao foram alteradas.');
} finally { await pool.end(); }
