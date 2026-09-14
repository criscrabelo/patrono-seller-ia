# Patrono Generation Worker

**Criado:** Rodada 8 (Digital Twin Operacional + Primeira Prévia Real).

O worker é o processo que roda o que a Rodada 7 já modelou (voz clonada, lip-sync, renderer) FORA do servidor web — Vercel/servidor de request HTTP não é lugar para workload longo de IA. Ele pode rodar numa máquina local (a máquina da proprietária, com ou sem GPU) ou num servidor compatível.

## Arquitetura

```
worker/
  digital-twin-worker.ts          # loop de polling real (Node/tsx)
  setup-digital-twin-worker.ps1   # instalação assistida (Windows)
  start-digital-twin-worker.ps1   # inicialização (Windows)
  requirements-chatterbox.txt     # dependências Python pinadas
  .venv-digital-twin/             # venv isolado — NUNCA versionado (.gitignore)
```

`lib/digital-twin-worker-core.ts` tem a lógica pura de processamento de um job (testável sem loop); `worker/digital-twin-worker.ts` é a casca que faz polling contínuo.

## Job Queue real (Postgres, sem Redis/SaaS)

`lib/digital-twin-job-queue.ts` — claim atômico via `SELECT ... FOR UPDATE SKIP LOCKED`, verificado com dois workers concorrendo de verdade contra o Postgres local: **nunca pegam o mesmo job**. Heartbeat renovado periodicamente; se parar (`worker offline`), o job volta a ficar reivindicável depois de `STALE_TIMEOUT_MS_PADRAO` (5 minutos) — **nunca vira `FAILED` só por falta de processador**, a UI mostra "Aguardando processador".

Estados do job (`DigitalTwinJob.status`, já existentes desde a Rodada 7): `QUEUED → PREPARING_AUDIO → GENERATING_VOICE → GENERATING_AVATAR → LIP_SYNC → RENDERING → VALIDATING → READY/FAILED/CANCELLED`.

Retry automático (regra 31/38): até 3 tentativas antes de virar `FAILED` de verdade; nunca reprocessa um job já `READY` com artefato válido.

## Instalação assistida (Windows)

1. `setup-digital-twin-worker.ps1` — detecta Python, FFmpeg, GPU NVIDIA/CUDA (via `nvidia-smi`, só detecta, **nunca instala/altera driver**), cria um virtualenv isolado (`.venv-digital-twin/`) e instala `requirements-chatterbox.txt` com versões pinadas.
2. `start-digital-twin-worker.ps1` — inicia o worker (Node/tsx). Pensado para ser registrado como tarefa agendada no logon do Windows (comando de exemplo no próprio script) — a proprietária não precisa abrir terminal no dia a dia depois disso.

## Detecção de infraestrutura

`lib/digital-twin-runtime.ts`, `classificarRuntime()`: `GPU_READY | GPU_LIMITED | CPU_ONLY | UNSUPPORTED`. A UI nunca mostra CUDA/VRAM cru — traduz para "Pronto para gerar avatar" / "Modo leve disponível".

## Saúde do worker

`GenerationWorkerHealth` (Prisma) — `workerId`, `online`, `gpuDetected`, `gpuName`, `vramGB`, `lastSeenAt`. Só aparece em Configurações → Digital Twin, **nunca na Home**.

## Segurança

- Worker acessa assets via `criarUrlAssinada()` (signed URL temporária) — nunca expõe o bucket inteiro.
- `reference audio`/rosto de referência nunca em log.
- Isolamento por workspace testado: um job nunca acessa asset de outro workspace (mesmo padrão de `lib/digital-twin-store.ts`).

## Fallback sem GPU (o que roda de verdade neste ambiente)

Quando Chatterbox/MuseTalk não estão disponíveis (como neste ambiente de desenvolvimento — ver `DIGITAL-TWIN-BENCHMARK.md`), `processarJobDeVerdade()` (`lib/digital-twin-worker-core.ts`) cai para `MOTION_GRAPHICS`/`PRODUCT_ONLY` — que usa só FFmpeg (já dependência do projeto) e **roda de verdade, sem GPU**. Testado com `worker/digital-twin-worker.ts --once` contra o Postgres local: claim → tentativa de render → resultado real.

## Custo

Nenhum serviço pago. Nenhum cloud GPU. **R$ 0,00.**
