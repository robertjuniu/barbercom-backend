BEGIN;
CREATE OR REPLACE FUNCTION validar_agenda_profissional() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE profissional_alvo bigint;
BEGIN
  IF TG_TABLE_NAME = 'turno_trabalho' THEN
    SELECT profissional_id INTO profissional_alvo FROM vinculo_profissional_unidade WHERE id = NEW.vinculo_id;
  ELSE
    profissional_alvo := NEW.profissional_id;
  END IF;
  PERFORM id FROM profissional WHERE id = profissional_alvo FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM turno_trabalho a
    JOIN vinculo_profissional_unidade va ON va.id = a.vinculo_id
    JOIN turno_trabalho b ON b.id > a.id AND b.dia_semana = a.dia_semana
    JOIN vinculo_profissional_unidade vb ON vb.id = b.vinculo_id
    WHERE va.profissional_id = profissional_alvo AND vb.profissional_id = profissional_alvo
      AND va.ativo AND vb.ativo AND a.hora_inicio < b.hora_fim AND a.hora_fim > b.hora_inicio
  ) THEN
    RAISE EXCEPTION 'Turnos conflitantes para o profissional' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_turno ON turno_trabalho;
CREATE TRIGGER validar_turno AFTER INSERT OR UPDATE ON turno_trabalho FOR EACH ROW EXECUTE FUNCTION validar_agenda_profissional();
DROP TRIGGER IF EXISTS validar_vinculo ON vinculo_profissional_unidade;
CREATE TRIGGER validar_vinculo AFTER INSERT OR UPDATE ON vinculo_profissional_unidade FOR EACH ROW EXECUTE FUNCTION validar_agenda_profissional();
COMMIT;
