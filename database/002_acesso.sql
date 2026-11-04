BEGIN;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS google_sub varchar(255) UNIQUE;
CREATE TABLE IF NOT EXISTS sessao (
    sid varchar(128) PRIMARY KEY,
    dados jsonb NOT NULL,
    expira_em timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessao_expira_idx ON sessao(expira_em);
COMMIT;
