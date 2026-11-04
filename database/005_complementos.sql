BEGIN;
ALTER TABLE unidade ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE unidade ADD COLUMN IF NOT EXISTS longitude double precision;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='unidade'::regclass AND conname='unidade_coordenadas') THEN
    ALTER TABLE unidade ADD CONSTRAINT unidade_coordenadas CHECK (
      (latitude IS NULL AND longitude IS NULL) OR
      (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS foto_profissional (
  profissional_id bigint PRIMARY KEY REFERENCES profissional(id),
  dados bytea NOT NULL CHECK (octet_length(dados) BETWEEN 1 AND 2097152)
);
ALTER TABLE agendamento ADD COLUMN IF NOT EXISTS origem varchar(12) NOT NULL DEFAULT 'AGENDAMENTO' CHECK (origem IN ('AGENDAMENTO','AVULSO'));
ALTER TABLE item_agendamento ADD COLUMN IF NOT EXISTS profissional_id bigint REFERENCES profissional(id);
UPDATE item_agendamento i SET profissional_id=v.profissional_id
  FROM agendamento a JOIN vinculo_profissional_unidade v ON v.id=a.vinculo_id
  WHERE i.agendamento_id=a.id AND i.profissional_id IS NULL;
COMMIT;
