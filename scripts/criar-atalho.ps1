# Cria o atalho "LocalDrop" na Area de Trabalho, apontando para scripts\LocalDrop.bat.
# Uso: npm run atalho
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$areaDeTrabalho = [Environment]::GetFolderPath('Desktop')
$caminhoAtalho = Join-Path $areaDeTrabalho 'LocalDrop.lnk'

$shell = New-Object -ComObject WScript.Shell
$atalho = $shell.CreateShortcut($caminhoAtalho)
$atalho.TargetPath = Join-Path $raiz 'scripts\LocalDrop.bat'
$atalho.WorkingDirectory = $raiz
$atalho.IconLocation = (Join-Path $raiz 'scripts\localdrop.ico') + ',0'
$atalho.Description = 'Receber arquivos do celular pelo Wi-Fi'
$atalho.Save()

Write-Host ''
Write-Host "  Atalho criado: $caminhoAtalho"
Write-Host '  De dois cliques nele para abrir o LocalDrop.'
Write-Host ''
