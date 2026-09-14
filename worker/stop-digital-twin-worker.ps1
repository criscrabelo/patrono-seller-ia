# stop-digital-twin-worker.ps1 (Rodada 9)
#
# Para o Patrono Generation Worker e, se solicitado, remove o
# agendamento de inicio automatico. Nunca apaga jobs em andamento —
# o worker offline eh tratado normalmente pela fila (heartbeat expira,
# outro worker retoma).

param(
    [switch]$RemoverInicioAutomatico
)

$processo = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*digital-twin-worker.ts*" }

if ($processo) {
    foreach ($p in $processo) {
        Write-Host "Parando worker (PID $($p.ProcessId))..." -ForegroundColor Cyan
        Stop-Process -Id $p.ProcessId -Force
    }
    Write-Host "Worker parado." -ForegroundColor Green
} else {
    Write-Host "Nenhum worker em execucao encontrado." -ForegroundColor Yellow
}

if ($RemoverInicioAutomatico) {
    $tarefa = Get-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -ErrorAction SilentlyContinue
    if ($tarefa) {
        Unregister-ScheduledTask -TaskName "PatronoDigitalTwinWorker" -Confirm:$false
        Write-Host "Inicio automatico removido (nao inicia mais sozinho no logon)." -ForegroundColor Green
    } else {
        Write-Host "Nenhum agendamento de inicio automatico encontrado." -ForegroundColor Yellow
    }
}
