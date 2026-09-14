# status-digital-twin-worker.ps1 (Rodada 9)
#
# Mostra o estado atual do worker em linguagem simples — nao tecnica.
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
