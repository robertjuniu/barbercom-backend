import pg from 'pg';

if (!process.env.DATABASE_URL && !process.env.PGHOST) throw new Error('Configure DATABASE_URL ou as variáveis PGHOST/PGDATABASE/PGUSER/PGPASSWORD.');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
pool.on('error', error => console.error('Conexao PostgreSQL interrompida:', error.code));
