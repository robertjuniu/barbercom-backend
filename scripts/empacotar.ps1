$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location $taskRoot
$taskItems = @('src','database','docs','scripts','test','views','public','package.json','package-lock.json','README.md','.env.example','.gitignore','outputs/integracao-frontend.md','outputs/configurar-google-e-sms.md','outputs/relatorio-entrega.md','outputs/frontend-figma.md','outputs/verificacao-mobile.md','outputs/SP07-modelagem-banco.pdf','outputs/SP07-modelagem-banco.md','outputs/SP07-diagrama-banco.mmd')
$taskOutput = Join-Path $taskRoot 'outputs\BarberCom-backend.zip'
$taskItems += @('docker','Dockerfile','docker-compose.yml','.dockerignore','.gitattributes','.env.docker.example','INTEGRACAO.md')
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$taskStream = [System.IO.File]::Open($taskOutput, [System.IO.FileMode]::Create)
$taskZip = [System.IO.Compression.ZipArchive]::new($taskStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($taskItem in $taskItems) {
        $taskPath = Join-Path $taskRoot $taskItem
        $taskFiles = if (Test-Path -LiteralPath $taskPath -PathType Container) { Get-ChildItem -LiteralPath $taskPath -File -Recurse } else { Get-Item -LiteralPath $taskPath }
        foreach ($taskFile in $taskFiles) {
            $taskRelative = $taskFile.FullName.Substring($taskRoot.Length + 1).Replace('\','/')
            if ($taskRelative -match '(^|/)(\.env|node_modules|work)(/|$)' -or $taskRelative -match 'acesso-local') { throw 'Arquivo privado detectado no pacote.' }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip, $taskFile.FullName, $taskRelative) | Out-Null
        }
    }
} finally { $taskZip.Dispose(); $taskStream.Dispose() }
Write-Output 'Pacote criado: outputs/BarberCom-backend.zip'
