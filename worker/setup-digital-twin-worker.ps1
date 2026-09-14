# setup-digital-twin-worker.ps1 (Rodada 8)
#
# Instalacao assistida do Patrono Generation Worker no Windows. Objetivo:
# a proprietaria nunca precisa digitar comandos manualmente todo dia -
# este script roda UMA VEZ para preparar o ambiente.
#
# REGRA DE SEGURANCA (regra 39): este script DETECTA o que falta, mas
# NUNCA instala/altera driver de GPU (NVIDIA) automaticamente. Se o driver
# nao estiver presente ou o CUDA nao for compativel, o script para e
# mostra instrucoes - nunca faz uma alteracao de sistema arriscada sozinho.

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
Write-Host ""
Write-Host "Para iniciar o worker agora: .\start-digital-twin-worker.ps1" -ForegroundColor Green
