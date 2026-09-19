# start-digital-twin-worker.ps1 (Rodada 8)
#
# Inicia o Patrono Generation Worker. Pensado para ser registrado como
# tarefa agendada do Windows (Task Scheduler) rodando no logon da usuaria,
# para que ela NUNCA precise abrir terminal no dia a dia (regra 11).
#
# Registro como tarefa agendada (rodar uma vez, manualmente, com privilegio
# adequado - este script NAO se auto-registra sozinho, por seguranca):
#   schtasks /Create /SC ONLOGON /TN "PatronoDigitalTwinWorker" ^
#     /TR "powershell.exe -File `"$PSScriptRoot\start-digital-twin-worker.ps1`""

param(
    [switch]$Once,
    [string]$VenvPath
)

. (Join-Path $PSScriptRoot "resolver-venv.ps1")

$nodeScript = Join-Path $PSScriptRoot "digital-twin-worker.ts"
$venvPath = Get-CaminhoVenvDigitalTwin -VenvPath $VenvPath -RaizWorker $PSScriptRoot

if (-not $venvPath) {
    Write-Host "Ambiente Python nao encontrado. Rode primeiro: .\setup-digital-twin-worker.ps1" -ForegroundColor Red
    Write-Host "Se o ambiente ja existe em outro lugar, informe onde:" -ForegroundColor Yellow
    Write-Host "  .\start-digital-twin-worker.ps1 -VenvPath C:\patrono-venv" -ForegroundColor Yellow
    Write-Host "  (ou defina a variavel de ambiente DIGITAL_TWIN_VENV)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Ambiente Python: $venvPath"

# Ativa o venv Python (usado pelos subprocessos de Chatterbox/MuseTalk
# chamados pelo worker Node) e inicia o worker de verdade (Node/tsx, mesma
# stack do resto do Patrono).
$env:VIRTUAL_ENV = $venvPath
$env:PATH = "$venvPath\Scripts;$env:PATH"

# O adapter do Chatterbox (lib/chatterbox-adapter.ts) resolve o interpretador
# por estas variaveis. Sem elas ele cairia no `python` do PATH - que no
# Windows costuma ser o atalho da Microsoft Store, sem o Chatterbox instalado.
$env:DIGITAL_TWIN_VENV = $venvPath
$env:DIGITAL_TWIN_PYTHON = Join-Path $venvPath "Scripts\python.exe"

Write-Host "Iniciando Patrono Generation Worker..." -ForegroundColor Cyan

if ($Once) {
    npx tsx $nodeScript --once
} else {
    npx tsx $nodeScript
}
