BEGIN;
CREATE TABLE IF NOT EXISTS agendamento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id bigint NOT NULL REFERENCES usuario(id),
  vinculo_id bigint NOT NULL REFERENCES vinculo_profissional_unidade(id),
  inicio timestamp NOT NULL,
  fim timestamp NOT NULL CHECK (fim > inicio),
  status varchar(12) NOT NULL DEFAULT 'CONFIRMADO' CHECK (status IN ('CONFIRMADO','CANCELADO','CONCLUIDO')),
  valor_total numeric(10,2) NOT NULL CHECK (valor_total >= 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_vinculo_inicio ON agendamento(vinculo_id, inicio);
CREATE TABLE IF NOT EXISTS item_agendamento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agendamento_id bigint NOT NULL REFERENCES agendamento(id),
  oferta_id bigint REFERENCES oferta_servico(id),
  nome varchar(120) NOT NULL,
  preco numeric(10,2) NOT NULL CHECK (preco >= 0),
  duracao_minutos integer NOT NULL CHECK (duracao_minutos >= 0),
  tipo varchar(10) NOT NULL DEFAULT 'SERVICO' CHECK (tipo IN ('SERVICO','ADICIONAL'))
);
CREATE TABLE IF NOT EXISTS verificacao_telefone (
  telefone varchar(15) PRIMARY KEY,
  nome varchar(120) NOT NULL,
  senha_hash varchar(255) NOT NULL,
  codigo_hash varchar(64) NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
