# setup-digital-twin-worker.ps1 (Rodada 8, atualizado na Rodada 9)
#
# Instalacao assistida do Patrono Generation Worker no Windows. Objetivo:
# a proprietaria nunca precisa digitar comandos manualmente todo dia -
# este script roda UMA VEZ para preparar o ambiente.
#
# REGRA DE SEGURANCA: este script DETECTA o que falta, mas NUNCA instala/
# altera driver de GPU (NVIDIA) automaticamente. Se o driver nao estiver
# presente ou o CUDA nao for compativel, o script para e mostra
# instrucoes - nunca faz uma alteracao de sistema arriscada sozinho.
#
# Rode primeiro diagnose-digital-twin-worker.ps1 para ver o diagnostico
# completo antes de instalar (regra 5 da Rodada 9).

param(
    [switch]$PularInicioAutomatico
)

Write-Host "=== Patrono Generation Worker - instalacao ===" -ForegroundColor Cyan

function Test-Command($nome) {
    return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

# 1. Detectar Python
if (-not (Test-Command "python")) {
    Write-Host "Python nao encontrado. Instale o Python 3.11 (https://www.python.org/downloads/) e rode este script de novo." -ForegroundColor Yellow
    exit 1
}
$pythonVersion = python --version
Write-Host "Python detectado: $pythonVersion"

# 2. Detectar FFmpeg (o projeto ja usa ffmpeg-static via npm, mas o worker
#    Python pode precisar de um ffmpeg no PATH para pos-processamento).
if (-not (Test-Command "ffmpeg")) {
    Write-Host "FFmpeg nao encontrado no PATH. O renderer principal do Patrono ja traz o proprio (ffmpeg-static)." -ForegroundColor Yellow
} else {
    Write-Host "FFmpeg detectado no PATH."
}

# 3. Detectar GPU NVIDIA / CUDA - SO DETECTA, nunca instala driver.
$temNvidia = Test-Command "nvidia-smi"
if ($temNvidia) {
    Write-Host "GPU NVIDIA detectada (nvidia-smi encontrado)." -ForegroundColor Green
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
} else {
    Write-Host "Nenhuma GPU NVIDIA detectada. O worker vai rodar em modo CPU (fallback: voz + motion graphics)." -ForegroundColor Yellow
}

# 4. Criar ambiente virtual Python ISOLADO (nunca polui o Python do sistema).
$venvPath = Join-Path $PSScriptRoot ".venv-digital-twin"
if (-not (Test-Path $venvPath)) {
    Write-Host "Criando ambiente virtual isolado em $venvPath ..."
    python -m venv $venvPath
}

# 5. Instalar dependencias fixas (requirements-chatterbox.txt) - versoes
#    pinadas, sem poluir o runtime principal do Patrono.
$requirements = Join-Path $PSScriptRoot "requirements-chatterbox.txt"
& "$venvPath\Scripts\pip.exe" install --quiet --upgrade pip
& "$venvPath\Scripts\pip.exe" install -r $requirements

Write-Host ""
Write-Host "Instalacao concluida. Os pesos do modelo (Chatterbox/MuseTalk) sao" -ForegroundColor Cyan
Write-Host "baixados automaticamente na primeira execucao real, a partir do" -ForegroundColor Cyan
Write-Host "Hugging Face Hub - NUNCA versionados neste repositorio." -ForegroundColor Cyan

# 6. Inicio automatico (regra 24) - mecanismo NATIVO do Windows (Task
#    Scheduler), sem instalar nada de terceiros. Sempre pede confirmacao -
#    nunca se auto-registra silenciosamente.
if (-not $PularInicioAutomatico) {
    Write-Host ""
    $resposta = Read-Host "Quer que o processador de videos inicie sozinho quando voce entrar no Windows? (s/n)"
    if ($resposta -eq 's') {
        $acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -File `"$PSScriptRoot\start-digital-twin-worker.ps1`""
        $gatilho = New-ScheduledTaskTrigger -AtLogOn
        Register-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -Action $acao -Trigger $gatilho -Description "Patrono Generation Worker - processa videos do Digital Twin localmente" -Force | Out-Null
        Write-Host "Inicio automatico configurado. Para desativar depois: .\stop-digital-twin-worker.ps1 -RemoverInicioAutomatico" -ForegroundColor Green
    } else {
        Write-Host "Ok, o inicio automatico nao foi configurado. Use start-digital-twin-worker.ps1 quando quiser processar." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Para iniciar o worker agora: .\start-digital-twin-worker.ps1" -ForegroundColor Green
Write-Host "Para ver o status a qualquer momento: .\status-digital-twin-worker.ps1" -ForegroundColor Green
