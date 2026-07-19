import { cookies } from 'next/headers'
import { prisma } from './prisma'

export const CONTA_ATIVA_COOKIE = 'contaAtivaId'

export async function getContaAtivaIdCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(CONTA_ATIVA_COOKIE)?.value ?? null
}

// Resolve a conta ativa de um usuário para uso nas rotas de API: usa o
// cookie se ele apontar pra uma conta de fato dona desse usuário, senão cai
// pra primeira conta do usuário (mesma regra de fallback do GET /api/contas).
// Retorna null só se o usuário ainda não tiver nenhuma conta.
export async function getContaAtivaId(userId: string): Promise<string | null> {
  const cookieContaId = await getContaAtivaIdCookie()
  if (cookieContaId) {
    const conta = await prisma.conta.findFirst({ where: { id: cookieContaId, userId } })
    if (conta) return conta.id
  }
  const primeira = await prisma.conta.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
  return primeira?.id ?? null
}
