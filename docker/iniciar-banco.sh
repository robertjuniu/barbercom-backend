#!/bin/bash
set -euo pipefail

# O backend usa uma conta própria, sem privilégios de superusuário.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE barbercom_app LOGIN PASSWORD %L', :'app_password') \gexec
GRANT CONNECT, CREATE ON DATABASE barbercom TO barbercom_app;
GRANT USAGE, CREATE ON SCHEMA public TO barbercom_app;
SQL
for migration in /opt/barbercom-sql/00*.sql; do
  psql -v ON_ERROR_STOP=1 --username barbercom_app --dbname "$POSTGRES_DB" --file "$migration"
done
