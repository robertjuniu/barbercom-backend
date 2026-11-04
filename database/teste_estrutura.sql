BEGIN;

DO $$
DECLARE
    unidade_barra bigint;
    unidade_centro bigint;
    profissional_teste bigint;
    servico_teste bigint;
    vinculo_teste bigint;
    turno_teste bigint;
    comando text;
BEGIN
    INSERT INTO unidade (nome, endereco) VALUES ('Barra teste', 'Endereco ficticio 1') RETURNING id INTO unidade_barra;
    INSERT INTO unidade (nome, endereco) VALUES ('Centro teste', 'Endereco ficticio 2') RETURNING id INTO unidade_centro;
    INSERT INTO profissional (nome) VALUES ('Profissional de teste') RETURNING id INTO profissional_teste;
    INSERT INTO servico (nome) VALUES ('Corte teste') RETURNING id INTO servico_teste;
    INSERT INTO oferta_servico (unidade_id, servico_id, preco, duracao_minutos)
    VALUES (unidade_barra, servico_teste, 35.00, 30), (unidade_centro, servico_teste, 40.00, 35);
    INSERT INTO vinculo_profissional_unidade (profissional_id, unidade_id)
    VALUES (profissional_teste, unidade_barra) RETURNING id INTO vinculo_teste;
    INSERT INTO profissional_servico VALUES (profissional_teste, servico_teste);
    INSERT INTO turno_trabalho (vinculo_id, dia_semana, hora_inicio, hora_fim)
    VALUES (vinculo_teste, 1, '09:00', '18:00') RETURNING id INTO turno_teste;
    INSERT INTO pausa_trabalho (turno_id, descricao, hora_inicio, hora_fim)
    VALUES (turno_teste, 'Almoco', '12:00', '13:00');
    INSERT INTO bloqueio_agenda (vinculo_id, data, descricao, tipo)
    VALUES (vinculo_teste, '2026-11-02', 'Feriado de teste', 'FERIADO');
    INSERT INTO bloqueio_agenda (vinculo_id, data, descricao, tipo, hora_inicio, hora_fim)
    VALUES (vinculo_teste, '2026-11-03', 'Ausencia de teste', 'INDISPONIBILIDADE', '15:00', '16:00');

    IF (SELECT count(DISTINCT preco) FROM oferta_servico WHERE servico_id = servico_teste) <> 2 THEN
        RAISE EXCEPTION 'O preco por unidade nao foi preservado';
    END IF;
    UPDATE unidade SET ativa = false WHERE id = unidade_barra;
    IF NOT EXISTS (SELECT 1 FROM vinculo_profissional_unidade WHERE id = vinculo_teste) THEN
        RAISE EXCEPTION 'A inativacao removeu um vinculo';
    END IF;

    FOREACH comando IN ARRAY ARRAY[
        'INSERT INTO unidade (nome, endereco) VALUES (''  '', ''Endereco'')',
        'INSERT INTO usuario (nome, telefone, senha_hash, perfil) VALUES (''Teste'', ''abc'', ''nao-e-senha-real'', ''GESTOR'')',
        'INSERT INTO usuario (nome, telefone, senha_hash, perfil) VALUES (''Teste'', ''71999999999'', ''nao-e-senha-real'', ''ADMIN'')',
        format('INSERT INTO oferta_servico (unidade_id, servico_id, preco, duracao_minutos) VALUES (%s, %s, -1, 30)', unidade_barra, servico_teste),
        format('INSERT INTO oferta_servico (unidade_id, servico_id, preco, duracao_minutos) VALUES (%s, %s, 35, 0)', unidade_barra, servico_teste),
        format('INSERT INTO turno_trabalho (vinculo_id, dia_semana, hora_inicio, hora_fim) VALUES (%s, 8, ''09:00'', ''18:00'')', vinculo_teste),
        format('INSERT INTO turno_trabalho (vinculo_id, dia_semana, hora_inicio, hora_fim) VALUES (%s, 1, ''18:00'', ''09:00'')', vinculo_teste),
        format('INSERT INTO pausa_trabalho (turno_id, descricao, hora_inicio, hora_fim) VALUES (%s, ''Pausa'', ''12:00'', ''12:00'')', turno_teste),
        format('INSERT INTO bloqueio_agenda (vinculo_id, data, descricao, tipo, hora_inicio) VALUES (%s, ''2026-11-03'', ''Teste'', ''FERIADO'', ''09:00'')', vinculo_teste)
    ] LOOP
        BEGIN
            EXECUTE comando;
            RAISE EXCEPTION 'Deveria rejeitar dados invalidos: %', comando;
        EXCEPTION WHEN check_violation THEN
            NULL;
        END;
    END LOOP;

    BEGIN
        INSERT INTO vinculo_profissional_unidade (profissional_id, unidade_id) VALUES (profissional_teste, unidade_barra);
        RAISE EXCEPTION 'Deveria rejeitar vinculo duplicado';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
    BEGIN
        INSERT INTO profissional_servico VALUES (-1, servico_teste);
        RAISE EXCEPTION 'Deveria rejeitar profissional inexistente';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
    BEGIN
        DELETE FROM unidade WHERE id = unidade_barra;
        RAISE EXCEPTION 'Deveria impedir exclusao da unidade referenciada';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
    RAISE NOTICE 'OK: cadastros, precos por unidade, inativacao e 12 rejeicoes de dados invalidos.';
END $$;

ROLLBACK;
