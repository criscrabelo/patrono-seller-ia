# Patrono Generation Worker

**Criado:** Rodada 8 (Digital Twin Operacional + Primeira Prévia Real). **Atualizado:** Rodada 9 (Worker Local + Primeira Voz Real) — diagnóstico Windows, pairing seguro (token), versão do worker, cache de modelos, ciclo de vida completo (start/stop/status/auto-start).

O worker é o processo que roda o que a Rodada 7 já modelou (voz clonada, lip-sync, renderer) FORA do servidor web — Vercel/servidor de request HTTP não é lugar para workload longo de IA. Ele pode rodar numa máquina local (a máquina da proprietária, com ou sem GPU) ou num servidor compatível.

## Arquitetura

```
worker/
  digital-twin-worker.ts             # loop de polling real (Node/tsx)
  diagnose-digital-twin-worker.ps1   # diagnóstico Windows, só leitura (Rodada 9)
  setup-digital-twin-worker.ps1      # instalação assistida (Windows)
  start-digital-twin-worker.ps1      # inicialização (Windows)
  stop-digital-twin-worker.ps1       # parada + remoção opcional do início automático (Rodada 9)
  status-digital-twin-worker.ps1     # status amigável em português (Rodada 9)
  requirements-chatterbox.txt        # dependências Python pinadas
  .venv-digital-twin/                # venv isolado — NUNCA versionado (.gitignore)
```

`lib/digital-twin-worker-core.ts` tem a lógica pura de processamento de um job (testável sem loop); `worker/digital-twin-worker.ts` é a casca que faz polling contínuo.

## Job Queue real (Postgres, sem Redis/SaaS)

`lib/digital-twin-job-queue.ts` — claim atômico via `SELECT ... FOR UPDATE SKIP LOCKED`, verificado com dois workers concorrendo de verdade contra o Postgres local: **nunca pegam o mesmo job**. Heartbeat renovado periodicamente; se parar (`worker offline`), o job volta a ficar reivindicável depois de `STALE_TIMEOUT_MS_PADRAO` (5 minutos) — **nunca vira `FAILED` só por falta de processador**, a UI mostra "Aguardando processador".

Estados do job (`DigitalTwinJob.status`, já existentes desde a Rodada 7): `QUEUED → PREPARING_AUDIO → GENERATING_VOICE → GENERATING_AVATAR → LIP_SYNC → RENDERING → VALIDATING → READY/FAILED/CANCELLED`.

Retry automático (regra 31/38): até 3 tentativas antes de virar `FAILED` de verdade; nunca reprocessa um job já `READY` com artefato válido.

## Diagnóstico primeiro (regra 5, Rodada 9)

`worker/diagnose-digital-twin-worker.ps1` — **somente leitura, nunca modifica nada no Windows**. Roda antes de qualquer instalação e imprime um JSON com: versão do Windows, CPU, RAM, GPU/VRAM/driver NVIDIA (`nvidia-smi`, sem instalar/atualizar driver), Python, FFmpeg, espaço em disco, e acesso de rede real (HEAD) a `huggingface.co`, `supabase.com` e o próprio Patrono. Esse diagnóstico alimenta `classificarMaquina()` (`lib/digital-twin-machine-classification.ts`), que devolve `FULL_DIGITAL_TWIN | VOICE_AND_LIPSYNC | VOICE_ONLY | MOTION_GRAPHICS_ONLY | UNAVAILABLE` — sempre a partir de detecção real, nunca assumida.

## Instalação assistida (Windows)

1. `setup-digital-twin-worker.ps1` — detecta Python, FFmpeg, GPU NVIDIA/CUDA (via `nvidia-smi`, só detecta, **nunca instala/altera driver**), cria um virtualenv isolado (`.venv-digital-twin/`) e instala `requirements-chatterbox.txt` com versões pinadas. Ao final, pergunta explicitamente (`Read-Host`) se a proprietária quer início automático no logon — só registra a tarefa agendada (`Register-ScheduledTask`) se a resposta for sim, nunca automaticamente.
2. `start-digital-twin-worker.ps1` — inicia o worker (Node/tsx).
3. `stop-digital-twin-worker.ps1` — para o processo do worker; com `-RemoverInicioAutomatico`, também remove a tarefa agendada (`Unregister-ScheduledTask`) — processo de desativação sempre explícito e documentado.
4. `status-digital-twin-worker.ps1` — mostra em português simples se o worker está rodando e se o início automático está ativo, sem jargão técnico.

Depois da instalação inicial, a proprietária não precisa abrir terminal no dia a dia — o worker inicia sozinho no logon (se ela escolheu essa opção) e os quatro scripts cobrem todo o ciclo de vida manual quando necessário.

## Versão do worker (Rodada 9, regra 25)

`lib/digital-twin-worker-version.ts` — `REQUIRED_WORKER_VERSION` e `verificarVersaoWorker()` comparam a versão que o worker reporta com a esperada; uma versão desatualizada só **recomenda** atualização (nunca aplica sozinho — nenhum download/execução de código arbitrário automático). O worker nunca executa código baixado sem ser o próprio pacote/versão que a proprietária instalou deliberadamente.

## Pairing seguro do worker (Rodada 9, regras 21-22)

`WorkerToken` (Prisma) + `lib/digital-twin-worker-token.ts` — a proprietária gera um token pelo painel (`/api/digital-twin/worker-token`), nunca sua senha. O token é um valor aleatório de 32 bytes, guardado só como hash SHA-256 (`timingSafeEqual` na verificação), escopado a **um único workspace**, revogável a qualquer momento, e nunca aparece em log (só o resultado da verificação — o `workspaceId` — é usado). O worker lê `DIGITAL_TWIN_WORKER_TOKEN` do ambiente e resolve o workspace pareado no startup; sem token válido, recusa reivindicar qualquer job (nunca "sem escopo" em produção).

## Cache de modelos (Rodada 9, regras 27-28)

`lib/digital-twin-model-cache.ts` — pesos de modelo (Chatterbox/MuseTalk) nunca são versionados no Git; ficam em `~/.patrono-digital-twin/model-cache` (configurável via `DIGITAL_TWIN_MODEL_CACHE_DIR`). `estimarTamanhoDownloadBytes()` mostra o tamanho aproximado à usuária antes de baixar (HEAD, sem baixar nada); `baixarComRetomada()` usa HTTP `Range` para retomar um download interrompido do ponto exato onde parou — testado com um servidor HTTP real e uma queda simulada a 60% (ver `DIGITAL-TWIN-BENCHMARK.md`).

## Detecção de infraestrutura

`lib/digital-twin-runtime.ts`, `classificarRuntime()`: `GPU_READY | GPU_LIMITED | CPU_ONLY | UNSUPPORTED`. A UI nunca mostra CUDA/VRAM cru — traduz para "Pronto para gerar avatar" / "Modo leve disponível".

## Saúde do worker

`GenerationWorkerHealth` (Prisma) — `workerId`, `online`, `gpuDetected`, `gpuName`, `vramGB`, `lastSeenAt`. Só aparece em Configurações → Digital Twin, **nunca na Home**.

## Terceiro kill switch — Worker ON/OFF (Rodada 9, regra 34)

`DigitalTwinProfile.workerPaused` — independente do Autopilot (`Workspace.automationPaused`) e do Digital Twin (`DigitalTwinProfile.enabled`). Um perfil pausado nunca tem seus jobs reivindicados (`reivindicarProximoJob()` filtra por `workerPaused = false` na própria query SQL) — segunda camada de defesa em `deveAbortarPorKillSwitch()` para o caso do worker pausar depois de já ter reivindicado o job, mas antes da etapa crítica de geração.

## Segurança

- Worker acessa assets via `criarUrlAssinada()` (signed URL temporária) — nunca expõe o bucket inteiro.
- `reference audio`/rosto de referência nunca em log.
- Isolamento por workspace testado: um job nunca acessa asset de outro workspace (mesmo padrão de `lib/digital-twin-store.ts`); um worker pareado a um workspace nunca reivindica job de outro, mesmo sem passar o `workspaceId` explicitamente errado (testado em `tests/rodada9-worker-real.test.ts`).

## Fallback sem GPU (o que roda de verdade neste ambiente)

Quando Chatterbox/MuseTalk não estão disponíveis (como neste ambiente de desenvolvimento — ver `DIGITAL-TWIN-BENCHMARK.md`), `processarJobDeVerdade()` (`lib/digital-twin-worker-core.ts`) cai para `MOTION_GRAPHICS`/`PRODUCT_ONLY` — que usa só FFmpeg (já dependência do projeto) e **roda de verdade, sem GPU**. Testado com `worker/digital-twin-worker.ts --once` contra o Postgres local: claim → tentativa de render → resultado real.

## Custo

Nenhum serviço pago. Nenhum cloud GPU. **R$ 0,00.**
