# Digital Twin — Benchmark Real

**Criado:** Rodada 8 (Digital Twin Operacional + Primeira Prévia Real).

Regra seguida à risca: **nada nesta tabela é estimado.** Cada linha é ou (a) um teste real executado nesta rodada, com resultado observado, ou (b) marcada `NÃO TESTADO — depende de GPU/pesos indisponíveis neste ambiente`, nunca um número inventado.

## Ambiente de teste (Rodada 8)

Detectado de verdade via `lib/digital-twin-runtime.ts` (`detectarCapacidadesRuntime()`), rodado nesta sessão:

```json
{
  "cpuCores": 4,
  "totalRamGB": 15.7,
  "freeRamGB": 14.9,
  "gpuDetected": false,
  "cudaAvailable": false,
  "freeDiskGB": 243.3
}
```

Classificação (`classificarRuntime()`): **`CPU_ONLY`**.

## Conectividade real testada nesta rodada

| Destino | Resultado | Método |
|---|---|---|
| `pypi.org` | ✅ Acessível (HTTP 200) | `curl` real |
| PyPI: pacote `chatterbox-tts` | ✅ Baixável — versão 0.1.7 confirmada, `pip index versions` e `pip download` reais | `pip3 download --no-deps` |
| `huggingface.co` (site) | ❌ Bloqueado — `403 connect_rejected (organization policy)` | `curl` real |
| `huggingface.co/api/models/...` | ❌ Bloqueado — mesmo erro | `curl` real |

**Conclusão real:** o pacote Python do Chatterbox É instalável neste ambiente (PyPI liberado), mas os **pesos do modelo** (`ve.pt`, `t3_mtl23ls_v2.safetensors`, `s3gen.pt`, `conds.pt`) são baixados via Hugging Face Hub dentro do próprio pacote (`hf_hub_download`) — e o Hugging Face está bloqueado pela política de rede deste ambiente. Ou seja: **mesmo com o pacote instalado, a geração de voz real não é possível aqui**, independente de GPU.

## Correção real encontrada (bug da Rodada 7)

Inspecionando o wheel real do `chatterbox-tts` (`unzip -l`/`unzip -p`), descobrimos que:
- O módulo Python correto é `chatterbox` (não `chatterbox_tts`, como a Rodada 7 assumia sem verificar).
- Não existe um repositório `ResembleAI/Chatterbox-Multilingual-pt-br` — o único `REPO_ID` do modelo multilíngue é `ResembleAI/chatterbox`, com `pt` (Portuguese genérico) em `SUPPORTED_LANGUAGES`.
- Existe também `ResembleAI/chatterbox-turbo` (variante "turbo", não avaliada nesta rodada).

`lib/chatterbox-adapter.ts` foi corrigido para refletir isso — ver commit da Rodada 8.

## Tabela de testes

| Motor | Hardware | Entrada | Saída | Tempo | Memória | Resultado |
|---|---|---|---|---|---|---|
| Chatterbox TTS (import do módulo Python) | CPU_ONLY (4 cores, 15.7GB RAM) | `import chatterbox` | — | — | — | **TESTADO REALMENTE**: `ModuleNotFoundError` — pacote não instalado neste ambiente (decisão: não instalar o stack pesado de torch/transformers/diffusers só para confirmar um `import`, já que os pesos são inalcançáveis de qualquer forma — ver seção de conectividade acima). |
| Chatterbox TTS (síntese de voz real, `TEXTO_TESTE_PT_BR`) | — | texto pt-BR | áudio | — | — | **PREPARADO PARA GPU** — não executado. Depende de pesos do Hugging Face Hub, bloqueado neste ambiente. |
| MuseTalk (lip-sync real) | — | vídeo + áudio | vídeo sincronizado | — | — | **PREPARADO PARA GPU** — não executado. Mesma limitação de rede + exige GPU/CUDA que este ambiente não tem. |
| Postgres Job Queue — claim atômico concorrente | CPU_ONLY | 2 workers, 1 job `QUEUED` | 1 worker vence, 1 recebe `null` | ~15-30ms por claim | — | **TESTADO REALMENTE** — `reivindicarProximoJob()` rodado com `Promise.all` de dois workers reais contra o Postgres local; nunca os dois pegaram o mesmo job. |
| Worker end-to-end (`--once`) | CPU_ONLY | 1 job `QUEUED` sem asset | Fallback Motion Graphics tentado, falha honesta (sem asset), job reagendado (retry automático) | < 1s (sem asset real para baixar) | — | **TESTADO REALMENTE** — `npx tsx worker/digital-twin-worker.ts --once` rodado contra o Postgres local nesta sessão. |
| RendererFFmpeg (Motion Graphics fallback, com asset real) | CPU_ONLY | imagem + overlays | vídeo MP4 9:16 | (ver Rodada 5 — já medido em rodadas anteriores, reaproveitado sem mudança nesta rodada) | — | **TESTADO EM RODADA ANTERIOR** (Rodada 5), reaproveitado aqui sem re-medição. |

## O que isso significa para a proprietária

- **Hoje** (ambiente sem GPU, sem acesso ao Hugging Face): o Digital Twin com voz clonada e avatar realista **não pode gerar nada de verdade** — o Autopilot cai automaticamente para `MOTION_GRAPHICS`/`PRODUCT_ONLY` (voz não clonada, motion graphics, captions, CTA), que **funciona de verdade** e produz vídeo TikTok-ready.
- **Para ativar o Digital Twin de verdade**, é necessário rodar o worker numa máquina com: acesso à internet SEM bloqueio ao Hugging Face (o bloqueio observado é uma política deste ambiente de desenvolvimento específico, não do Chatterbox/MuseTalk em si) e, para MuseTalk, uma GPU NVIDIA compatível.

## Custo

Nenhum serviço pago usado para gerar os números acima — apenas `curl`/`pip download` (grátis) e o Postgres/FFmpeg já existentes no projeto.
