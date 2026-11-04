$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
node scripts/configurar-local.js
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel preparar o banco local.' }
npm.cmd start
