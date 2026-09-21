# status-digital-twin-worker.ps1 (Rodada 9)
#
# Mostra o estado atual do worker em linguagem simples - nao tecnica.
# Detalhes tecnicos (PID, versao) ficam disponiveis, mas nao sao o
# destaque principal.

$processo = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*digital-twin-worker.ts*" }
$tarefa = Get-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -ErrorAction SilentlyContinue

if ($processo) {
    Write-Host "Processador de videos: CONECTADO" -ForegroundColor Green
    foreach ($p in $processo) {
        Write-Host "  (detalhe tecnico: PID $($p.ProcessId), iniciado em $($p.CreationDate))"
    }
} else {
    Write-Host "Processador de videos: DESLIGADO" -ForegroundColor Yellow
    Write-Host "  Use start-digital-twin-worker.ps1 para iniciar manualmente,"
    Write-Host "  ou reinicie o computador se o inicio automatico estiver configurado."
}

if ($tarefa) {
    Write-Host "Inicio automatico: ATIVADO (roda sozinho ao entrar no Windows)" -ForegroundColor Cyan
    Write-Host "  Para desativar: .\stop-digital-twin-worker.ps1 -RemoverInicioAutomatico"
} else {
    Write-Host "Inicio automatico: DESATIVADO" -ForegroundColor Yellow
    Write-Host "  Para ativar: rode .\setup-digital-twin-worker.ps1 novamente e aceite o passo de agendamento."
}

# Estado da tarefa agendada (Rodada 15) - antes era preciso abrir o
# Agendador de Tarefas para saber se o inicio automatico estava mesmo ativo.
. (Join-Path $PSScriptRoot "patrono-comum.ps1")

$tarefa = Get-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -ErrorAction SilentlyContinue
Write-Host ""
if ($tarefa) {
    $info = Get-ScheduledTaskInfo -TaskName "PatronoDigitalTwinWorker" -ErrorAction SilentlyContinue
    Write-Host "Inicio automatico: CONFIGURADO" -ForegroundColor Green
    Write-Host "  estado          : $($tarefa.State)"
    Write-Host "  principal       : $($tarefa.Principal.UserId) (nivel $($tarefa.Principal.RunLevel))"
    Write-Host "  gatilhos        : $($tarefa.Triggers.Count)"
    Write-Host "  reinicio        : ate $($tarefa.Settings.RestartCount)x a cada $($tarefa.Settings.RestartInterval)"
    Write-Host "  multiplas inst. : $($tarefa.Settings.MultipleInstances)"
    if ($info) {
        Write-Host "  ultima execucao : $($info.LastRunTime) (resultado $($info.LastTaskResult))"
    }
} else {
    Write-Host "Inicio automatico: NAO CONFIGURADO" -ForegroundColor Yellow
    Write-Host "  Para configurar: .\setup-digital-twin-worker.ps1"
}

$logDir = Join-Path $env:LOCALAPPDATA "Patrono\logs"
Write-Host ""
Write-Host "Logs em: $logDir"
if (Test-Path (Join-Path $logDir "worker.log")) {
    Write-Host "Ultimas linhas:"
    Get-Content (Join-Path $logDir "worker.log") -Tail 5 | ForEach-Object { Write-Host "  $_" }
}
