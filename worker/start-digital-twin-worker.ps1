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
    [switch]$Once
)

$venvPath = Join-Path $PSScriptRoot ".venv-digital-twin"
$nodeScript = Join-Path $PSScriptRoot "digital-twin-worker.ts"

if (-not (Test-Path $venvPath)) {
    Write-Host "Ambiente nao encontrado. Rode primeiro: .\setup-digital-twin-worker.ps1" -ForegroundColor Red
    exit 1
}

# Ativa o venv Python (usado pelos subprocessos de Chatterbox/MuseTalk
# chamados pelo worker Node) e inicia o worker de verdade (Node/tsx, mesma
# stack do resto do Patrono).
$env:VIRTUAL_ENV = $venvPath
$env:PATH = "$venvPath\Scripts;$env:PATH"

Write-Host "Iniciando Patrono Generation Worker..." -ForegroundColor Cyan

if ($Once) {
    npx tsx $nodeScript --once
} else {
    npx tsx $nodeScript
}
