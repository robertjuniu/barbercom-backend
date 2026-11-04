import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import pg from 'pg';

const bin = process.env.POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const data = resolve('work/postgres-local/data');
const log = resolve('work/postgres-local/postgres.log');
const port = 55438;
mkdirSync(resolve('work/postgres-local'), { recursive: true });
if (!existsSync('.env')) {
  if (existsSync(`${data}/PG_VERSION`)) throw new Error('Ja existe um banco local sem .env. Preserve os dados e recupere a configuracao.');
  const password = randomBytes(24).toString('hex');
  writeFileSync('.env', [
    `DATABASE_URL=postgresql://barbercom_app:${password}@127.0.0.1:${port}/barbercom`,
    `LOCAL_OWNER_PASSWORD=${randomBytes(24).toString('hex')}`,
    `SESSION_SECRET=${randomBytes(48).toString('hex')}`,
    'PORT=3000', 'ADMIN_PHONE=71999990000', `ADMIN_PASSWORD=${randomBytes(12).toString('base64url')}`, ''
  ].join('\n'), { flag: 'wx' });
}
loadEnvFile('.env');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== String(port) || url.pathname !== '/barbercom' || !process.env.LOCAL_OWNER_PASSWORD) {
  throw new Error('Este configurador so gerencia o banco local isolado. Para outro banco, aplique o SQL manualmente.');
}
if (!existsSync(`${data}/PG_VERSION`)) {
  const passwordFile = resolve('work/postgres-local/owner-password.tmp');
  writeFileSync(passwordFile, process.env.LOCAL_OWNER_PASSWORD, { mode: 0o600 });
  try {
    execFileSync(`${bin}/initdb.exe`, ['-D', data, '-U', 'barbercom_owner', '-A', 'scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C'], { windowsHide: true, stdio: 'ignore' });
  } finally { unlinkSync(passwordFile); }
}
let running = false;
try {
  execFileSync(`${bin}/pg_ctl.exe`, ['-D', data, 'status'], { windowsHide: true, stdio: 'ignore' });
  running = true;
} catch (error) { if (error.status !== 3) throw error; }
if (!running) {
  execFileSync(`${bin}/pg_ctl.exe`, ['-D', data, '-l', log, '-o', `-h 127.0.0.1 -p ${port}`, '-w', '-t', '20', 'start'], { windowsHide: true, stdio: 'ignore' });
}
const owner = new pg.Client({ host: '127.0.0.1', port, user: 'barbercom_owner', password: process.env.LOCAL_OWNER_PASSWORD, database: 'postgres', connectionTimeoutMillis: 5000 });
await owner.connect();
try {
  if (!(await owner.query("SELECT 1 FROM pg_roles WHERE rolname = 'barbercom_app'")).rowCount) {
    await owner.query(`CREATE ROLE barbercom_app LOGIN PASSWORD ${pg.escapeLiteral(decodeURIComponent(url.password))}`);
  }
  if (!(await owner.query("SELECT 1 FROM pg_database WHERE datname = 'barbercom'")).rowCount) {
    await owner.query('CREATE DATABASE barbercom OWNER barbercom_app');
  }
} finally { await owner.end(); }
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows: [row] } = await client.query("SELECT to_regclass('public.usuario') AS tabela");
  if (!row.tabela) await client.query(readFileSync('database/001_estrutura.sql', 'utf8'));
  await client.query(readFileSync('database/002_acesso.sql', 'utf8'));
  await client.query(readFileSync('database/003_conflitos.sql', 'utf8'));
  await client.query(readFileSync('database/004_agendamentos.sql', 'utf8'));
  await client.query(readFileSync('database/005_complementos.sql', 'utf8'));
} finally { await client.end(); }
await import('./preparar-aplicacao.js');
console.log('Banco BarberCom pronto em 127.0.0.1:55438. O PostgreSQL original permanece separado.');
