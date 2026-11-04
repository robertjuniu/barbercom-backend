$ErrorActionPreference = 'Stop'
$taskData = Join-Path (Split-Path -Parent $PSScriptRoot) 'work\postgres-local\data'
if (Test-Path -LiteralPath (Join-Path $taskData 'postmaster.pid')) {
    & 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D $taskData -m fast -w -t 20 stop
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel encerrar o banco local BarberCom.' }
}
