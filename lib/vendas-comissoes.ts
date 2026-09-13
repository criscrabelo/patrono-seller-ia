import { prisma } from '@/lib/prisma'

/**
 * Leituras agregadas de Venda/Comissão para alimentar a tela "Vendas e
 * Comissões" no design (design_handoff §6/§11).
 *
 * Regra de negócio central: venda ≠ comissão.
 * - Uma venda tem estado próprio: PENDING | CONFIRMED | CANCELLED.
 * - Uma comissão tem estado próprio: EXPECTED | CONFIRMED | RECEIVED.
 * - Uma venda CANCELLED nunca deve contar como confirmada, e a comissão
 *   associada a ela não entra nos totais de "confirmada"/"recebida".
 */

export async function resumoVendas(workspaceId: string) {
  const porStatus = await prisma.sale.groupBy({
    by: ['status'],
    where: { workspaceId },
    _count: { status: true },
  })

  const contagem: Record<string, number> = { PENDING: 0, CONFIRMED: 0, CANCELLED: 0 }
  for (const linha of porStatus) contagem[linha.status] = linha._count.status

  return contagem
}

export async function resumoComissoes(workspaceId: string) {
  // Comissões cuja venda associada foi cancelada não contam em nenhum
  // total — nem previsto, nem confirmado, nem recebido.
  const comissoes = await prisma.commission.findMany({
    where: {
      workspaceId,
      OR: [{ saleId: null }, { sale: { status: { not: 'CANCELLED' } } }],
    },
    select: { status: true, expectedAmount: true, confirmedAmount: true, receivedAmount: true },
  })

  let prevista = 0
  let confirmada = 0
  let recebida = 0

  for (const c of comissoes) {
    if (c.status === 'EXPECTED') prevista += c.expectedAmount ?? 0
    if (c.status === 'CONFIRMED') confirmada += c.confirmedAmount ?? c.expectedAmount ?? 0
    if (c.status === 'RECEIVED') recebida += c.receivedAmount ?? c.confirmedAmount ?? 0
  }

  return { prevista, confirmada, recebida }
}
