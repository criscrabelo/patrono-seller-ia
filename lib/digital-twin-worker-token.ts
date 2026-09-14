/**
 * Worker Pairing (Rodada 9, regras 21-22) — credencial PRÓPRIA do worker
 * local, nunca a senha da usuária. Escopo mínimo: só reivindica jobs do
 * workspace ao qual o token pertence. Revogável a qualquer momento.
 *
 * Só o HASH do token é persistido (`WorkerToken.tokenHash`) — o valor
 * bruto é devolvido UMA ÚNICA VEZ na criação (a usuária copia para o
 * worker) e nunca mais recuperável, nem por quem tem acesso ao banco.
 * Nunca aparece em log (nem o token, nem o hash em texto legível de log
 * de aplicação — só a auditoria registra o `id`/`label`).
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface WorkerTokenCriado {
  id: string
  token: string // só existe aqui, na resposta da criação — nunca mais recuperável
}

/** Gera um novo token para o workspace — nunca reaproveita um token de outro workspace. */
export async function gerarTokenWorker(workspaceId: string, label?: string): Promise<WorkerTokenCriado> {
  const token = randomBytes(32).toString('hex')
  const registro = await prisma.workerToken.create({
    data: { workspaceId, tokenHash: hashToken(token), label: label ?? null },
  })
  return { id: registro.id, token }
}

/**
 * Valida o token e devolve o workspace autorizado — nunca aceita token
 * revogado, nunca vaza para qual workspace um token INVÁLIDO pertenceria.
 */
export async function verificarTokenWorker(token: string): Promise<{ workspaceId: string; tokenId: string } | null> {
  const hash = hashToken(token)
  const registro = await prisma.workerToken.findUnique({ where: { tokenHash: hash } })
  if (!registro || registro.revokedAt) return null

  // Comparação em tempo constante contra o hash já buscado — evita timing
  // attack mesmo que o índice único já tenha feito o lookup exato.
  const a = Buffer.from(hash)
  const b = Buffer.from(registro.tokenHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  await prisma.workerToken.update({ where: { id: registro.id }, data: { lastUsedAt: new Date() } })
  return { workspaceId: registro.workspaceId, tokenId: registro.id }
}

export async function revogarTokenWorker(workspaceId: string, tokenId: string): Promise<boolean> {
  const resultado = await prisma.workerToken.updateMany({
    where: { id: tokenId, workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return resultado.count === 1
}

/** Nunca inclui o hash — só o suficiente para a usuária identificar/revogar cada token. */
export async function listarTokensWorker(workspaceId: string) {
  return prisma.workerToken.findMany({
    where: { workspaceId },
    select: { id: true, label: true, createdAt: true, revokedAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  })
}
