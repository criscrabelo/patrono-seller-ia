/**
 * P2.14.7 (Fase 0A) — Runs do Supervisor: criação idempotente e transição
 * atômica de estado.
 *
 * - `iniciarRun` com a mesma chave devolve o mesmo run (nada roda duas vezes).
 * - `transitar` usa compare-and-set (`updateMany where estado = de`): duas
 *   instâncias concorrentes não avançam o mesmo run; a perdedora recebe
 *   ErroDeTransicao e não executa a etapa.
 * - Cada transição grava RUN_STATE_CHANGED na mesma transação.
 * - Entrar em estado irreversível passa pelas travas (kill switch/Safe Mode).
 */
import type { EstadoDoRun, Prisma, SupervisorRun } from '@prisma/client'
import { prisma } from '../prisma'
import { registrarEvento } from '../ledger'
import { novoCorrelationId } from '../observabilidade'
import { exigirPodeAgir } from '../kill-switch'
import { ESTADOS_IRREVERSIVEIS, podeTransitar, retomadaValida } from './estados'

export class ErroDeTransicao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
  }
}

export type ModoDoRun = 'MANUAL' | 'ASSISTED' | 'AUTOMATIC' | 'SIMULACAO'

export async function iniciarRun(p: { workspaceId: string; chave: string; modo: ModoDoRun }): Promise<SupervisorRun> {
  return prisma.supervisorRun.upsert({
    where: { workspaceId_chave: { workspaceId: p.workspaceId, chave: p.chave } },
    create: { workspaceId: p.workspaceId, chave: p.chave, modo: p.modo, correlationId: novoCorrelationId('run') },
    update: {},
  })
}

function checkpointComo(obj: Prisma.JsonValue | null): Record<string, unknown> {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {}
}

export async function transitar(p: {
  workspaceId: string
  runId: string
  de: EstadoDoRun
  para: EstadoDoRun
  checkpoint?: Record<string, unknown>
  erro?: string | null
  env?: Record<string, string | undefined>
}): Promise<SupervisorRun> {
  const run = await prisma.supervisorRun.findFirst({ where: { id: p.runId, workspaceId: p.workspaceId } })
  if (!run) throw new ErroDeTransicao('Run não encontrado.')
  if (run.estado !== p.de) throw new ErroDeTransicao(`Run está em ${run.estado}, não em ${p.de}.`)
  if (!podeTransitar(p.de, p.para)) throw new ErroDeTransicao(`Transição proibida: ${p.de} → ${p.para}.`)

  const anterior = checkpointComo(run.checkpoint)
  if (p.de === 'PAUSADO' && !retomadaValida(anterior.estadoAntesDaPausa as EstadoDoRun | undefined, p.para)) {
    throw new ErroDeTransicao(`Retomada inválida: o run parou em ${String(anterior.estadoAntesDaPausa)}.`)
  }
  if (ESTADOS_IRREVERSIVEIS.has(p.para) && run.modo !== 'SIMULACAO') await exigirPodeAgir(p.workspaceId, p.env)

  const checkpoint = {
    ...anterior,
    ...(p.checkpoint ?? {}),
    ...(p.para === 'PAUSADO' ? { estadoAntesDaPausa: p.de } : {}),
  }
  const terminal = p.para === 'CONCLUIDO' || p.para === 'FALHOU' || p.para === 'CANCELADO'

  return prisma.$transaction(async (tx) => {
    const r = await tx.supervisorRun.updateMany({
      where: { id: p.runId, workspaceId: p.workspaceId, estado: p.de },
      data: {
        estado: p.para,
        passo: { increment: 1 },
        checkpoint: checkpoint as Prisma.InputJsonValue,
        ...(p.para === 'FALHOU' ? { ultimoErro: p.erro ?? 'falha sem detalhe', tentativas: { increment: 1 } } : {}),
        ...(terminal ? { concluidoEm: new Date() } : {}),
      },
    })
    if (r.count !== 1) throw new ErroDeTransicao('Outra execução avançou este run primeiro.')
    await registrarEvento(
      {
        workspaceId: p.workspaceId,
        tipo: 'RUN_STATE_CHANGED',
        chaveIdempotencia: `run:${p.runId}:${run.passo + 1}`,
        entidadeTipo: 'SupervisorRun',
        entidadeId: p.runId,
        runId: p.runId,
        correlationId: run.correlationId,
        payload: { de: p.de, para: p.para, erro: p.erro ?? null },
      },
      tx
    )
    return tx.supervisorRun.findUniqueOrThrow({ where: { id: p.runId } })
  })
}
