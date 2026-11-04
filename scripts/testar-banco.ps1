param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
foreach ($taskExecutable in 'initdb.exe', 'pg_ctl.exe', 'psql.exe') {
    if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $taskExecutable))) {
        throw "PostgreSQL nao encontrado em $PostgresBin"
    }
}
$taskRun = Join-Path $taskRoot ('work\postgres-teste-' + [guid]::NewGuid().ToString('N'))
$taskData = Join-Path $taskRun 'data'
New-Item -ItemType Directory -Path $taskRun -Force | Out-Null
$taskListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$taskListener.Start()
$taskPort = $taskListener.LocalEndpoint.Port
$taskListener.Stop()
$taskStarted = $false
try {
    # shortcut: autenticacao trust apenas na instancia descartavel em loopback; o banco da aplicacao usara senha.
    & "$PostgresBin\initdb.exe" -D $taskData -U barbercom_teste -A trust --encoding=UTF8 --locale=C | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao inicializar o PostgreSQL de teste.' }
    # pg_ctl inicia um processo persistente; aguardar somente o controlador evita prender o terminal no servidor.
    $taskController = Start-Process -FilePath "$PostgresBin\pg_ctl.exe" -WindowStyle Hidden -PassThru -ArgumentList @(
        '-D', ('"' + $taskData + '"'), '-l', ('"' + (Join-Path $taskRun 'postgres.log') + '"'),
        '-o', ('"-h 127.0.0.1 -p ' + $taskPort + '"'), '-w', '-t', '20', 'start'
    )
    if (-not $taskController.WaitForExit(30000) -or $taskController.ExitCode -ne 0) {
        throw "Falha ao iniciar. Consulte $taskRun\postgres.log"
    }
    $taskStarted = $true
    foreach ($taskSql in '001_estrutura.sql', 'teste_estrutura.sql') {
        & "$PostgresBin\psql.exe" -X -w -h 127.0.0.1 -p $taskPort -U barbercom_teste -d postgres -v ON_ERROR_STOP=1 -f (Join-Path $taskRoot "database\$taskSql")
        if ($LASTEXITCODE -ne 0) { throw "Falha em $taskSql" }
    }
    Write-Output 'PASSOU: estrutura criada e validada em PostgreSQL temporario.'
} finally {
    if ($taskStarted -or (Test-Path -LiteralPath (Join-Path $taskData 'postmaster.pid'))) {
        & "$PostgresBin\pg_ctl.exe" -D $taskData -m fast -w -t 20 stop | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel encerrar o PostgreSQL temporario em $taskData" }
    }
    Write-Output "Arquivos de diagnostico: $taskRun"
}
