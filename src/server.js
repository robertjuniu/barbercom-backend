import { pool } from './db.js';
import { createApp } from './app.js';
import { googleConfig } from './google.js';

await pool.query('SELECT 1 FROM unidade LIMIT 1');
const app = createApp(pool, process.env.SESSION_SECRET, { allowAnyPassword: process.env.ALLOW_ANY_PASSWORD === 'true', demoGestor: process.env.DEMO_GESTOR === 'true', google: googleConfig(), frontendOrigin: process.env.FRONTEND_ORIGIN || null });
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log(`BarberCom aberto em http://127.0.0.1:${server.address().port}`);
});
server.on('error', error => { console.error('Nao foi possivel iniciar:', error.code); process.exitCode = 1; pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end()));
}
