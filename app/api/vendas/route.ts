import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarResultado, atualizarStatusVenda } from '@/lib/vendas-comissoes'
import { z } from 'zod'

// "Vendas e Comissões" → "Registrar resultado" (design_handoff §4).
// Sale é a fonte única de vendas a partir desta rodada — nenhuma leitura
// nova soma o contador legado de LinkDinamico.

const registrarSchema = z.object({
  productId: z.string().min(1),
  affiliateProgramId: z.string().optional(),
  linkId: z.string().optional(),
  contentId: z.string().optional(),
  date: z.string().optional(),
  amount: z.number().positive().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
  expectedCommission: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  // Idempotência persistente (Rodada 4) — ver lib/vendas-comissoes.ts
  // `registrarResultado()`. A tela gera esta chave uma vez por tentativa
  // de envio e reenvia a mesma em cada retry.
  idempotencyKey: z.string().min(1).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const vendas = await prisma.sale.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      ...(status && { status }),
    },
    include: {
      product: { select: { nome: true } },
      affiliateProgram: { select: { platform: true } },
      commissions: true,
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(vendas)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = registrarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const { productId } = parsed.data

  const produto = await prisma.produto.findFirst({
    where: { id: productId, workspaceId: session.user.workspaceId },
  })
  if (!produto) return NextResponse.json({ error: 'Selecione um produto para continuar' }, { status: 400 })

  if (parsed.data.affiliateProgramId) {
    const programa = await prisma.affiliateProgram.findFirst({
      where: { id: parsed.data.affiliateProgramId, workspaceId: session.user.workspaceId },
    })
    if (!programa) return NextResponse.json({ error: 'Programa não encontrado' }, { status: 400 })
  }

  const resultado = await registrarResultado({
    workspaceId: session.user.workspaceId,
    actorUserId: session.user.id,
    // PROVENIÊNCIA (P0.2 Bloco 1): esta rota só é alcançada por usuária
    // autenticada, registrando um resultado no workspace dela. É a definição
    // de operação real. Seeds e testes chamam `registrarResultado()`
    // diretamente e declaram SEED/TEST_FIXTURE — nunca passam por aqui.
    //
    // Limite honesto: se a proprietária registrar uma venda de treino pela
    // tela de verdade, isso entra como REAL_OPERATION. Nenhuma tecnologia
    // resolve isso; só a correção explícita e auditada resolveria.
    dataOrigin: 'REAL_OPERATION',
    productId: parsed.data.productId,
    affiliateProgramId: parsed.data.affiliateProgramId ?? null,
    linkId: parsed.data.linkId ?? null,
    contentId: parsed.data.contentId ?? null,
    date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    amount: parsed.data.amount ?? null,
    status: parsed.data.status,
    expectedCommission: parsed.data.expectedCommission ?? null,
    notes: parsed.data.notes ?? null,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  })

  return NextResponse.json(resultado, { status: 201 })
}

const alterarStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = alterarStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const sale = await atualizarStatusVenda({
    workspaceId: session.user.workspaceId,
    saleId: parsed.data.id,
    actorUserId: session.user.id,
    status: parsed.data.status,
    notes: parsed.data.notes,
  })
  if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })

  return NextResponse.json(sale)
}
