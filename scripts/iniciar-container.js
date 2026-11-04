import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pool } from '../src/db.js';
import { seedContainer } from './seed-container.js';

await mkdir('work', { recursive: true });
try {
  await writeFile('work/session-secret', randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (error) { if (error.code !== 'EEXIST') throw error; }
process.env.SESSION_SECRET = await readFile('work/session-secret', 'utf8');
try {
  await seedContainer(pool);
  console.log('Dados de demonstração disponíveis. Contas de teste descritas em INTEGRACAO.md.');
  await import('../src/server.js');
} catch (error) {
  await pool.end();
  throw error;
}
