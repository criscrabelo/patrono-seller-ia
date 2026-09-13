import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'

/**
 * `Sale`/`Commission` são a FONTE ÚNICA de vendas e comissões do MVP.
 *
 * O contador legado em `LinkDinamico` (`conversoes`/`receitaTotal`) está
 * marcado `DEPRECATED_LEGACY` no schema desde a Rodada 4: nenhuma operação
 * nova o incrementa mais, e nenhuma leitura nova o soma. As telas "Meus
 * Links" e "Monetização" migraram para ler o resumo por link calculado
 * aqui (`resumoPorLink`), a partir de `Sale`. A coluna continua existindo
 * no schema só para não quebrar quem já dependia dela antes desta rodada —
 * não é removida enquanto houver esse risco. Nunca somar legado + Sale.
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
 * Resumo por link (Rodada 4) — substitui a leitura de
 * `LinkDinamico.conversoes`/`receitaTotal` (DEPRECATED_LEGACY) nas telas
 * "Meus Links" e "Monetização". Conversões = Sale CONFIRMED com esse
 * `linkId`; receita = soma dos valores de venda dessas Sales (Sale
 * CANCELLED nunca entra). Cliques continuam vindo do próprio
 * `LinkDinamico.cliques` (fonte de tracking, não muda nesta rodada).
 */
export async function resumoPorLink(workspaceId: string): Promise<Map<string, { conversoes: number; receitaTotal: number }>> {
  const vendas = await prisma.sale.findMany({
    where: { workspaceId, status: 'CONFIRMED', linkId: { not: null } },
    select: {
      linkId: true,
      commissions: { select: { status: true, expectedAmount: true, confirmedAmount: true, receivedAmount: true } },
    },
  })

  const mapa = new Map<string, { conversoes: number; receitaTotal: number }>()
  for (const venda of vendas) {
    if (!venda.linkId) continue
    const atual = mapa.get(venda.linkId) ?? { conversoes: 0, receitaTotal: 0 }
    atual.conversoes += 1
    // Mesma lógica de "receita reconhecida" do ranking por produto: usa o
    // valor já confirmado/recebido quando existir, senão o previsto (é o
    // que a tela "Meus Links" já mostrava antes — a comissão calculada na
    // hora do registro, guardada como `expectedAmount`).
    atual.receitaTotal += venda.commissions.reduce((soma, c) => {
      if (c.status === 'RECEIVED') return soma + (c.receivedAmount ?? 0)
      if (c.status === 'CONFIRMED') return soma + (c.confirmedAmount ?? 0)
      return soma + (c.expectedAmount ?? 0)
    }, 0)
    mapa.set(venda.linkId, atual)
  }
  return mapa
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
  // Idempotência persistente (Rodada 4). A tela gera esta chave UMA VEZ por
  // tentativa de envio (ex.: crypto.randomUUID() ao abrir o formulário) e
  // reenvia a MESMA chave em cada retry — clique repetido, timeout, refresh,
  // retry de rede — até o envio ter sucesso. Sem isso, a janela de 5s usada
  // como fallback abaixo não é garantia financeira suficiente (dois envios
  // separados por mais de 5s, ou uma race condition entre duas chamadas
  // simultâneas, ainda poderiam duplicar).
  idempotencyKey?: string | null
}

/**
 * Registra um resultado manual (a tela "Vendas e Comissões" chama isso em
 * "Registrar resultado"): cria a Sale e a Commission (EXPECTED) associada,
 * numa única transação — nunca existe Commission órfã de uma Sale que
 * falhou ao ser criada.
 *
 * Idempotência em duas camadas:
 * 1. Persistente (principal): se `idempotencyKey` é enviada e já existe uma
 *    Sale com essa chave neste workspace, devolve ela — nunca cria outra.
 *    Reforçada por uma constraint UNIQUE no banco (`@@unique([workspaceId,
 *    idempotencyKey])`), então mesmo duas chamadas simultâneas com a mesma
 *    chave (race condition) não conseguem criar duas Sales: a segunda
 *    esbarra na constraint e busca a que a primeira já criou.
 * 2. Best-effort por janela de tempo (fallback, mantido da Rodada 3): sem
 *    chave, uma Sale idêntica (mesmo produto, valor, status) criada nos
 *    últimos 5 segundos ainda é detectada como duplicata — cobre chamadas
 *    antigas que não enviam chave, mas não é garantia forte sozinha.
 */
export async function registrarResultado(input: RegistrarResultadoInput) {
  if (input.idempotencyKey) {
    const existente = await prisma.sale.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } },
      include: { commissions: true },
    })
    if (existente) {
      return { sale: existente, commission: existente.commissions[0] ?? null, duplicado: true }
    }
  } else {
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
  }

  try {
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
          idempotencyKey: input.idempotencyKey ?? null,
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
  } catch (e) {
    // Race condition: duas chamadas com a MESMA idempotencyKey chegaram ao
    // mesmo tempo. A constraint única do banco rejeita a segunda — em vez
    // de propagar o erro, busca e devolve a Sale que a primeira criou.
    const violouUnicidade = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
    if (violouUnicidade && input.idempotencyKey) {
      const existente = await prisma.sale.findUnique({
        where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } },
        include: { commissions: true },
      })
      if (existente) {
        return { sale: existente, commission: existente.commissions[0] ?? null, duplicado: true }
      }
    }
    throw e
  }
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
