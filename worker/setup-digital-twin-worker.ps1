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
    [switch]$PularInicioAutomatico,
    [string]$VenvPath
)

. (Join-Path $PSScriptRoot "resolver-venv.ps1")

Write-Host "=== Patrono Generation Worker - instalacao ===" -ForegroundColor Cyan

function Test-Command($nome) {
    return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

# Descobre um Python REAL. `Get-Command python` sozinho nao serve no Windows:
# ele encontra o atalho da Microsoft Store em WindowsApps, que nao e um
# interpretador - responde "Python was not found" e faz o venv falhar.
# Verificado na maquina da proprietaria: o diagnostico chegou a reportar
# "pythonDisponivel: true" por causa desse atalho, sem haver Python algum.
function Get-PythonReal {
    $candidatos = @()
    if ($env:DIGITAL_TWIN_PYTHON) { $candidatos += $env:DIGITAL_TWIN_PYTHON }
    $candidatos += "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    $candidatos += (Get-ChildItem "$env:LOCALAPPDATA\Programs\Python" -Directory -ErrorAction SilentlyContinue |
                    Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName "python.exe" })
    $doPath = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ($doPath -and $doPath -notlike "*\WindowsApps\*") { $candidatos += $doPath }

    foreach ($c in $candidatos) {
        if (-not $c -or -not (Test-Path $c)) { continue }
        $v = & $c --version 2>&1
        if ($LASTEXITCODE -eq 0 -and "$v" -match "^Python 3") { return @{ Caminho = $c; Versao = "$v" } }
    }
    return $null
}

# 1. Detectar Python
$python = Get-PythonReal
if (-not $python) {
    Write-Host "Python 3 nao encontrado." -ForegroundColor Yellow
    Write-Host "Instale com:  winget install --id Python.Python.3.11 --scope user" -ForegroundColor Yellow
    Write-Host "(ou baixe em https://www.python.org/downloads/) e rode este script de novo." -ForegroundColor Yellow
    exit 1
}
$pythonBin = $python.Caminho
Write-Host "Python detectado: $($python.Versao)  ($pythonBin)"

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
#    O local NAO e fixo dentro do repositorio: em caminho profundo (OneDrive)
#    a instalacao do PyTorch estoura o limite de 260 caracteres do Windows.
#    Ver worker/resolver-venv.ps1 para o porque e a ordem de resolucao.
$venvPath = Get-CaminhoVenvDigitalTwin -VenvPath $VenvPath -RaizWorker $PSScriptRoot
if (-not $venvPath) {
    $venvPath = Get-CaminhoVenvParaCriar -VenvPath $VenvPath -RaizWorker $PSScriptRoot
    Write-Host "Criando ambiente virtual isolado em $venvPath ..."
    & $pythonBin -m venv $venvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha ao criar o ambiente virtual." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Ambiente virtual ja existe em $venvPath"
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
        # O -VenvPath e passado explicitamente: a tarefa agendada roda numa
        # sessao propria, sem as variaveis de ambiente desta janela, e nao
        # teria como descobrir um venv fora do local padrao.
        $acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -File `"$PSScriptRoot\start-digital-twin-worker.ps1`" -VenvPath `"$venvPath`""

        # WATCHDOG (Rodada 12) - mecanismo NATIVO do Windows, sem supervisor
        # proprio. Em 20/09/2026 o worker foi encerrado de fora (pressao de
        # memoria) e ficou horas parado, porque nada o trazia de volta. O
        # backoff do db-resiliencia so cobre o worker VIVO perdendo o banco;
        # nao cobre o processo morto.
        #
        # Dois gatilhos: logon (sessao da proprietaria) e boot (reinicio sem
        # ninguem logar).
        $gatilhos = @(
            (New-ScheduledTaskTrigger -AtLogOn),
            (New-ScheduledTaskTrigger -AtStartup)
        )

        # RestartCount/RestartInterval: o proprio agendador reergue o worker
        # a cada 2 min se ele morrer. MultipleInstances IgnoreNew e a rede de
        # seguranca do lado do Windows para a mesma coisa que o lock de PID
        # garante do lado do Node - duas camadas, de proposito.
        # ExecutionTimeLimit 0 = sem limite: processo residente nao expira.
        # StartWhenAvailable: se a maquina estava desligada na hora do
        # gatilho, roda assim que possivel.
        $configuracoes = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RestartCount 999 `
            -RestartInterval (New-TimeSpan -Minutes 2) `
            -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
            -MultipleInstances IgnoreNew

        Register-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -Action $acao -Trigger $gatilhos -Settings $configuracoes -Description "Patrono Generation Worker - processa videos do Digital Twin localmente (reinicia sozinho se cair)" -Force | Out-Null
        Write-Host "Inicio automatico configurado, com reinicio automatico a cada 2 min se o processo cair." -ForegroundColor Green
        Write-Host "Para desativar depois: .\stop-digital-twin-worker.ps1 -RemoverInicioAutomatico" -ForegroundColor Green
    } else {
        Write-Host "Ok, o inicio automatico nao foi configurado. Use start-digital-twin-worker.ps1 quando quiser processar." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Para iniciar o worker agora: .\start-digital-twin-worker.ps1" -ForegroundColor Green
Write-Host "Para ver o status a qualquer momento: .\status-digital-twin-worker.ps1" -ForegroundColor Green
