import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'

/**
 * `Sale`/`Commission` são a FONTE ÚNICA de vendas e comissões do MVP.
 *
 * O contador legado em `LinkDinamico` (`conversoes`/`receitaTotal`) segue
 * existindo no schema e continua sendo escrito por `POST /api/links/[id]/venda`
 * — só por compatibilidade com as telas antigas "Meus Links" e
 * "Monetização", que ainda o exibem e não fazem parte desta rodada. Nenhuma
 * leitura NOVA (Dashboard/Resultados, Vendas e Comissões, primeira
 * comissão) soma esse contador — todas leem exclusivamente `Sale`/
 * `Commission` daqui pra frente. Nunca somar os dois.
 *
 * Regra de negócio central: venda ≠ comissão.
 * - Uma venda tem estado próprio: PENDING | CONFIRMED | CANCELLED.
 * - Uma comissão tem estado próprio: EXPECTED | CONFIRMED | RECEIVED.
 * - Uma venda CANCELLED nunca deve contar como confirmada, e a comissão
 *   associada a ela não entra nos totais de "prevista"/"confirmada"/"recebida"
 *   nem no ranking de produtos vendidos.
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

/**
 * Ranking de produtos (substitui o antigo cálculo de "Lucro e Escala" que
 * somava `LinkDinamico.conversoes`/`receitaTotal`). Cliques continuam vindo
 * dos links (fonte de tracking); vendas/receita agora vêm de `Sale`
 * CONFIRMED e da comissão CONFIRMED/RECEIVED associada — nunca de
 * CANCELLED.
 */
export async function lucroEscalaPorProduto(workspaceId: string) {
  const [links, vendasConfirmadas] = await Promise.all([
    prisma.linkDinamico.findMany({
      where: { workspaceId },
      select: { produtoId: true, cliques: true },
    }),
    prisma.sale.findMany({
      where: { workspaceId, status: 'CONFIRMED', productId: { not: null } },
      select: {
        productId: true,
        amount: true,
        product: { select: { nome: true } },
        commissions: { select: { status: true, confirmedAmount: true, receivedAmount: true } },
      },
    }),
  ])

  const cliquesPorProduto = new Map<string, number>()
  for (const l of links) {
    cliquesPorProduto.set(l.produtoId, (cliquesPorProduto.get(l.produtoId) ?? 0) + l.cliques)
  }

  const porProduto = new Map<
    string,
    { nome: string; cliques: number; conversoes: number; receitaTotal: number }
  >()

  for (const venda of vendasConfirmadas) {
    if (!venda.productId || !venda.product) continue
    const atual = porProduto.get(venda.productId) ?? {
      nome: venda.product.nome,
      cliques: cliquesPorProduto.get(venda.productId) ?? 0,
      conversoes: 0,
      receitaTotal: 0,
    }
    atual.conversoes += 1
    // Receita reconhecida = comissão já confirmada/recebida sobre a venda;
    // se ainda não há comissão confirmada, conta o valor previsto para não
    // esconder a venda do ranking enquanto a comissão amadurece.
    const comissaoReconhecida = venda.commissions.reduce((soma, c) => {
      if (c.status === 'RECEIVED') return soma + (c.receivedAmount ?? 0)
      if (c.status === 'CONFIRMED') return soma + (c.confirmedAmount ?? 0)
      return soma
    }, 0)
    atual.receitaTotal += comissaoReconhecida
    porProduto.set(venda.productId, atual)
  }

  return [...porProduto.entries()].map(([produtoId, p]) => ({ produtoId, ...p }))
}

/**
 * "Primeira comissão" — condição de negócio do fluxo aprovado (design_handoff
 * §2: "...Registrar venda/comissão → Primeira comissão"). O handoff não dá
 * uma regra numérica além do nome da etapa; a leitura mais defensável do
 * texto ("comissão", não apenas "venda") é: a etapa se completa quando existe
 * ao menos uma Commission CONFIRMED ou RECEIVED (uma comissão apenas
 * EXPECTED ainda é uma previsão, não uma comissão de fato reconhecida).
 * Documentado como decisão explícita em DOCUMENTACAO-PATRONO-SELLER.md —
 * não é um número inventado, é a leitura mais conservadora do texto
 * disponível, e pode ser revista se o Design especificar outra regra.
 */
export async function primeiraComissao(workspaceId: string) {
  const comissao = await prisma.commission.findFirst({
    where: {
      workspaceId,
      status: { in: ['CONFIRMED', 'RECEIVED'] },
      OR: [{ saleId: null }, { sale: { status: { not: 'CANCELLED' } } }],
    },
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { nome: true } },
      sale: { select: { id: true, amount: true, date: true } },
      affiliateProgram: { select: { platform: true } },
    },
  })

  if (!comissao) return { concluida: false as const }

  return {
    concluida: true as const,
    comissao: {
      id: comissao.id,
      status: comissao.status,
      valor: comissao.status === 'RECEIVED' ? comissao.receivedAmount : comissao.confirmedAmount,
      produto: comissao.product?.nome ?? null,
      plataforma: comissao.affiliateProgram?.platform ?? null,
      vendaId: comissao.sale?.id ?? null,
      data: comissao.sale?.date ?? comissao.confirmedAt ?? comissao.receivedAt ?? comissao.createdAt,
    },
  }
}

type RegistrarResultadoInput = {
  workspaceId: string
  actorUserId: string
  productId: string
  affiliateProgramId?: string | null
  linkId?: string | null
  contentId?: string | null
  date?: Date
  amount?: number | null
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  expectedCommission?: number | null
  notes?: string | null
}

/**
 * Registra um resultado manual (a tela "Vendas e Comissões" chama isso em
 * "Registrar resultado"): cria a Sale e a Commission (EXPECTED) associada,
 * numa única transação — nunca existe Commission órfã de uma Sale que
 * falhou ao ser criada.
 *
 * Proteção contra duplo clique: se já existe uma Sale idêntica (mesmo
 * workspace, produto, valor e status) criada nos últimos 5 segundos, essa
 * chamada devolve o registro existente em vez de criar um segundo — sem
 * exigir nenhum campo novo no formulário nem nova dependência.
 */
export async function registrarResultado(input: RegistrarResultadoInput) {
  const janela = new Date(Date.now() - 5000)
  const duplicata = await prisma.sale.findFirst({
    where: {
      workspaceId: input.workspaceId,
      productId: input.productId,
      amount: input.amount ?? null,
      status: input.status,
      createdAt: { gte: janela },
    },
    orderBy: { createdAt: 'desc' },
    include: { commissions: true },
  })
  if (duplicata) {
    return { sale: duplicata, commission: duplicata.commissions[0] ?? null, duplicado: true }
  }

  const { sale, commission } = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        workspaceId: input.workspaceId,
        productId: input.productId,
        affiliateProgramId: input.affiliateProgramId ?? null,
        linkId: input.linkId ?? null,
        contentId: input.contentId ?? null,
        date: input.date ?? new Date(),
        amount: input.amount ?? null,
        status: input.status,
        source: 'manual',
        notes: input.notes ?? null,
      },
    })

    const commission = await tx.commission.create({
      data: {
        workspaceId: input.workspaceId,
        saleId: sale.id,
        productId: input.productId,
        affiliateProgramId: input.affiliateProgramId ?? null,
        expectedAmount: input.expectedCommission ?? null,
        status: 'EXPECTED',
        expectedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        action: 'venda.criada',
        entityType: 'Sale',
        entityId: sale.id,
        metadata: { productId: input.productId, status: sale.status, amount: sale.amount },
      },
    })

    return { sale, commission }
  })

  return { sale, commission, duplicado: false }
}

/** Altera o status de uma venda (PENDING/CONFIRMED/CANCELLED), com auditoria. */
export async function atualizarStatusVenda(params: {
  workspaceId: string
  saleId: string
  actorUserId: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  notes?: string | null
}) {
  const atual = await prisma.sale.findFirst({
    where: { id: params.saleId, workspaceId: params.workspaceId },
  })
  if (!atual) return null

  const sale = await prisma.sale.update({
    where: { id: params.saleId },
    data: { status: params.status, ...(params.notes !== undefined && { notes: params.notes }) },
  })

  await registrarAuditoria({
    workspaceId: params.workspaceId,
    userId: params.actorUserId,
    action: params.status === 'CANCELLED' ? 'venda.cancelada' : 'venda.alterada',
    entityType: 'Sale',
    entityId: sale.id,
    metadata: { statusAnterior: atual.status, statusNovo: sale.status },
  })

  return sale
}

/** Altera o status/valores de uma comissão (EXPECTED/CONFIRMED/RECEIVED), com auditoria. */
export async function atualizarComissao(params: {
  workspaceId: string
  commissionId: string
  actorUserId: string
  status: 'EXPECTED' | 'CONFIRMED' | 'RECEIVED'
  confirmedAmount?: number | null
  receivedAmount?: number | null
  notes?: string | null
}) {
  const atual = await prisma.commission.findFirst({
    where: { id: params.commissionId, workspaceId: params.workspaceId },
  })
  if (!atual) return null

  const commission = await prisma.commission.update({
    where: { id: params.commissionId },
    data: {
      status: params.status,
      ...(params.confirmedAmount !== undefined && {
        confirmedAmount: params.confirmedAmount,
        confirmedAt: new Date(),
      }),
      ...(params.receivedAmount !== undefined && {
        receivedAmount: params.receivedAmount,
        receivedAt: new Date(),
      }),
      ...(params.notes !== undefined && { notes: params.notes }),
    },
  })

  const action =
    params.status === 'RECEIVED'
      ? 'comissao.recebida'
      : params.status === 'CONFIRMED'
        ? 'comissao.confirmada'
        : 'comissao.alterada'

  await registrarAuditoria({
    workspaceId: params.workspaceId,
    userId: params.actorUserId,
    action,
    entityType: 'Commission',
    entityId: commission.id,
    metadata: { statusAnterior: atual.status, statusNovo: commission.status },
  })

  return commission
}
