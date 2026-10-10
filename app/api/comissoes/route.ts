import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resumoComissoes, atualizarComissao } from '@/lib/vendas-comissoes'
import { z } from 'zod'

// "Vendas e Comissões" — bloco de Comissões (prevista/confirmada/recebida).
// Commission é a fonte única a partir desta rodada.

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [comissoes, resumo] = await Promise.all([
    prisma.commission.findMany({
      where: { workspaceId: session.user.workspaceId },
      include: {
        product: { select: { nome: true } },
        affiliateProgram: { select: { platform: true } },
        sale: { select: { id: true, status: true, amount: true, date: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    resumoComissoes(session.user.workspaceId),
  ])

  return NextResponse.json({ comissoes, resumo })
}

const alterarSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['EXPECTED', 'CONFIRMED', 'RECEIVED']),
  confirmedAmount: z.number().nonnegative().optional(),
  receivedAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = alterarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const commission = await atualizarComissao({
    workspaceId: session.user.workspaceId,
    commissionId: parsed.data.id,
    actorUserId: session.user.id,
    status: parsed.data.status,
    confirmedAmount: parsed.data.confirmedAmount,
    receivedAmount: parsed.data.receivedAmount,
    notes: parsed.data.notes,
  })
  if (!commission) return NextResponse.json({ error: 'Comissão não encontrada' }, { status: 404 })

  return NextResponse.json(commission)
}
