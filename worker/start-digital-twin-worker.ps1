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
    [string]$VenvPath,
    [string]$EnvFile,
    [string]$ExigirRef
)

. (Join-Path $PSScriptRoot "resolver-venv.ps1")

$nodeScript = Join-Path $PSScriptRoot "digital-twin-worker.ts"

# -EnvFile: carrega as variaveis de um arquivo .env especifico.
#
# Necessario para rodar residente: como processo de longa duracao (tarefa
# agendada, logon), o worker NAO herda o ambiente de nenhum terminal. Sem
# isto ele dependia do que por acaso estivesse no shell - e um worker que
# "as vezes" acha o banco e pior do que um que falha na hora.
if ($EnvFile) {
    if (-not (Test-Path $EnvFile)) {
        Write-Host "Arquivo de ambiente nao encontrado: $EnvFile" -ForegroundColor Red
        exit 1
    }
    foreach ($linha in Get-Content $EnvFile) {
        if ($linha -match '^\s*#' -or $linha -notmatch '=') { continue }
        $nome, $valor = $linha -split '=', 2
        $nome = $nome.Trim()
        $valor = $valor.Trim() -replace '^"|"$', ''
        if ($nome) { Set-Item -Path "Env:$nome" -Value $valor }
    }
    Write-Host "Ambiente carregado de: $EnvFile"
}

# -ExigirRef: trava de seguranca. So inicia se o banco de destino contiver
# este identificador. Serve para garantir que um worker de teste jamais
# processe jobs do banco de producao por engano - especialmente quando
# registrado como tarefa agendada, em que ninguem ve a saida.
if ($ExigirRef) {
    $destino = "$env:DATABASE_URL$env:DIRECT_URL"
    if (-not $destino) {
        Write-Host "ABORTADO: -ExigirRef foi pedido mas nenhum banco esta configurado." -ForegroundColor Red
        exit 1
    }
    if ($destino -notlike "*$ExigirRef*") {
        Write-Host "ABORTADO: o banco configurado nao corresponde a '$ExigirRef'." -ForegroundColor Red
        Write-Host "O worker nao vai iniciar para evitar processar jobs do ambiente errado." -ForegroundColor Red
        exit 1
    }
    Write-Host "Destino confirmado: $ExigirRef" -ForegroundColor Green
}
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

# Caminho ABSOLUTO do script de sintese. Sem isto o adapter o derivaria do
# diretorio atual - e uma tarefa agendada roda a partir de System32, onde o
# arquivo nao existe.
$env:DIGITAL_TWIN_SYNTH_SCRIPT = Join-Path $PSScriptRoot "chatterbox_synthesize.py"

# O `npx` resolve o `tsx` subindo a arvore de node_modules a partir do
# diretorio atual. Rodando de System32 ele nao acharia e tentaria BAIXAR o
# pacote. Entrar na raiz do repositorio e obrigatorio, nao cosmetico.
$raizRepo = Split-Path $PSScriptRoot -Parent
Set-Location $raizRepo

Write-Host "Iniciando Patrono Generation Worker..." -ForegroundColor Cyan

if ($Once) {
    npx tsx $nodeScript --once
} else {
    npx tsx $nodeScript
}
