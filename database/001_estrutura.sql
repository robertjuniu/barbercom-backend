BEGIN;

CREATE TABLE usuario (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    telefone varchar(15) NOT NULL UNIQUE CHECK (telefone ~ '^[0-9]{10,15}$'),
    senha_hash varchar(255) NOT NULL CHECK (btrim(senha_hash) <> ''),
    perfil varchar(10) NOT NULL CHECK (perfil IN ('GESTOR', 'CLIENTE')),
    ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE unidade (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    endereco varchar(255) NOT NULL CHECK (btrim(endereco) <> ''),
    ativa boolean NOT NULL DEFAULT true
);

CREATE TABLE profissional (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    foto_url varchar(500),
    ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE servico (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE oferta_servico (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidade_id bigint NOT NULL REFERENCES unidade(id),
    servico_id bigint NOT NULL REFERENCES servico(id),
    preco numeric(10,2) NOT NULL CHECK (preco >= 0),
    duracao_minutos integer NOT NULL CHECK (duracao_minutos > 0),
    ativa boolean NOT NULL DEFAULT true,
    UNIQUE (unidade_id, servico_id)
);

CREATE TABLE vinculo_profissional_unidade (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profissional_id bigint NOT NULL REFERENCES profissional(id),
    unidade_id bigint NOT NULL REFERENCES unidade(id),
    ativo boolean NOT NULL DEFAULT true,
    UNIQUE (profissional_id, unidade_id)
);

CREATE TABLE profissional_servico (
    profissional_id bigint NOT NULL REFERENCES profissional(id),
    servico_id bigint NOT NULL REFERENCES servico(id),
    PRIMARY KEY (profissional_id, servico_id)
);

CREATE TABLE turno_trabalho (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vinculo_id bigint NOT NULL REFERENCES vinculo_profissional_unidade(id),
    dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio time NOT NULL,
    hora_fim time NOT NULL,
    CHECK (hora_fim > hora_inicio),
    UNIQUE (vinculo_id, dia_semana, hora_inicio, hora_fim)
);

CREATE TABLE pausa_trabalho (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    turno_id bigint NOT NULL REFERENCES turno_trabalho(id),
    descricao varchar(120) NOT NULL CHECK (btrim(descricao) <> ''),
    hora_inicio time NOT NULL,
    hora_fim time NOT NULL,
    CHECK (hora_fim > hora_inicio)
);

CREATE TABLE bloqueio_agenda (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vinculo_id bigint NOT NULL REFERENCES vinculo_profissional_unidade(id),
    data date NOT NULL,
    descricao varchar(120) NOT NULL CHECK (btrim(descricao) <> ''),
    tipo varchar(20) NOT NULL CHECK (tipo IN ('FERIADO', 'INDISPONIBILIDADE')),
    hora_inicio time,
    hora_fim time,
    CHECK (
        (hora_inicio IS NULL AND hora_fim IS NULL)
        OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)
    )
);

COMMIT;
