import session from 'express-session';

export class PostgresSessionStore extends session.Store {
  constructor(db) { super(); this.db = db; }
  get(sid, callback) {
    this.db.query('SELECT dados FROM sessao WHERE sid = $1 AND expira_em > now()', [sid])
      .then(result => callback(null, result.rows[0]?.dados ?? null), callback);
  }
  set(sid, data, callback = () => {}) {
    const expires = data.cookie?.expires ?? new Date(Date.now() + 7200000);
    this.db.query(`INSERT INTO sessao (sid, dados, expira_em) VALUES ($1,$2,$3)
      ON CONFLICT (sid) DO UPDATE SET dados = EXCLUDED.dados, expira_em = EXCLUDED.expira_em`, [sid, JSON.stringify(data), expires])
      .then(() => callback(), callback);
  }
  destroy(sid, callback = () => {}) {
    this.db.query('DELETE FROM sessao WHERE sid = $1', [sid]).then(() => callback(), callback);
  }
  touch(sid, data, callback = () => {}) {
    this.db.query('UPDATE sessao SET expira_em = $1 WHERE sid = $2', [data.cookie.expires, sid]).then(() => callback(), callback);
  }
}
