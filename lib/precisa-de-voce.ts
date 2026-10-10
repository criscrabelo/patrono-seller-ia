/**
 * P2.15 (Fase 1) — "Precisa de você": a fila central de exceções e aprovações.
 *
 * Regra de ouro: só aparece o que SÓ a titular pode decidir. Antes de
 * listar, a fila se limpa sozinha:
 *   - pedido vencido → EXPIRADA;
 *   - escolha cujo candidato já não está apresentado (a titular escolheu em
 *     Oportunidades, descartou, ou uma coleta nova mudou o top) → CANCELADA.
 *
 * Decidir executa a ação aprovada na hora (aprovar escolha = escolher o
 * produto), sempre pelos motores com as mesmas garantias (idempotência,
 * atomicidade, ledger). "Sempre aprovar casos assim" vira ApprovalRule.
 */
import type { ApprovalRequest } from '@prisma/client'
import { prisma } from './prisma'
import { criarRegra, decidirAprovacao, ErroDeAprovacao, expirarVencidas, pendentes, type CondicaoDaRegra } from './aprovacoes'
import { escolherCandidato } from './curadoria'
import { TIPO_ESCOLHA, TIPO_EXCECAO } from './supervisor/ciclo'

export interface ItemPrecisaDeVoce {
  id: string
  tipo: string
  titulo: string
  resumo: string
  porque: string[]
  risco: string
  criadoEm: string
  expiraEm: string | null
  /** Rótulos dos botões, pela natureza do pedido. */
  acoes: { aprovar: string; rejeitar: string }
  link: string | null
  podeVirarRegra: boolean
}

export function rotulos(tipo: string): ItemPrecisaDeVoce['acoes'] {
  if (tipo === TIPO_EXCECAO) return { aprovar: 'Já resolvi', rejeitar: 'Ignorar' }
  if (tipo === TIPO_ESCOLHA) return { aprovar: 'Escolher este produto', rejeitar: 'Agora não' }
  return { aprovar: 'Aprovar', rejeitar: 'Rejeitar' }
}

function paraItem(r: ApprovalRequest): ItemPrecisaDeVoce {
  const acao = (r.acaoProposta ?? {}) as Record<string, unknown>
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    resumo: r.resumo,
    porque: r.porque,
    risco: r.risco,
    criadoEm: r.criadoEm.toISOString(),
    expiraEm: r.expiraEm?.toISOString() ?? null,
    acoes: rotulos(r.tipo),
    link: typeof acao.link === 'string' ? acao.link : r.tipo === TIPO_ESCOLHA ? '/oportunidades' : null,
    podeVirarRegra: r.tipo === TIPO_ESCOLHA,
  }
}

/** Limpa o que já não precisa da titular e devolve o que sobra. */
export async function listarPrecisaDeVoce(workspaceId: string, agora = new Date()): Promise<ItemPrecisaDeVoce[]> {
  await expirarVencidas(workspaceId, agora)
  const lista = await pendentes(workspaceId, agora)
  const escolhas = lista.filter((r) => r.tipo === TIPO_ESCOLHA)
  if (escolhas.length) {
    const ids = escolhas.map((r) => (r.acaoProposta as { candidatoId?: string } | null)?.candidatoId).filter((x): x is string => !!x)
    const vivos = new Set(
      (await prisma.candidatoDeProduto.findMany({ where: { workspaceId, id: { in: ids }, status: 'APRESENTADO' }, select: { id: true } })).map((c) => c.id)
    )
    const mortos = escolhas.filter((r) => !vivos.has((r.acaoProposta as { candidatoId?: string } | null)?.candidatoId ?? ''))
    if (mortos.length) {
      await prisma.approvalRequest.updateMany({
        where: { workspaceId, id: { in: mortos.map((m) => m.id) }, status: 'PENDENTE' },
        data: { status: 'CANCELADA', motivoDaDecisao: 'O candidato já não está entre os apresentados.' },
      })
    }
    const mortosIds = new Set(mortos.map((m) => m.id))
    return lista.filter((r) => !mortosIds.has(r.id)).map(paraItem)
  }
  return lista.map(paraItem)
}

export async function contarPrecisaDeVoce(workspaceId: string, agora = new Date()): Promise<number> {
  return (await listarPrecisaDeVoce(workspaceId, agora)).length
}

export interface ResultadoDaDecisao {
  status: 'APROVADA' | 'REJEITADA'
  mensagem: string
  regraCriada: boolean
}

/** A titular decide; a ação aprovada é executada na hora. */
export async function decidirPrecisaDeVoce(p: {
  workspaceId: string
  userId: string
  id: string
  decisao: 'APROVAR' | 'REJEITAR'
  motivo?: string | null
  /** Só para escolha de produto: "sempre aprovar casos assim". */
  sempre?: boolean
  agora?: Date
}): Promise<ResultadoDaDecisao> {
  const agora = p.agora ?? new Date()
  const pedido = await prisma.approvalRequest.findFirst({ where: { id: p.id, workspaceId: p.workspaceId } })
  if (!pedido) throw new ErroDeAprovacao(404, 'Pedido não encontrado.')

  const { status } = await decidirAprovacao({ workspaceId: p.workspaceId, id: p.id, decisao: p.decisao, userId: p.userId, motivo: p.motivo ?? null, agora })
  let mensagem = status === 'APROVADA' ? 'Feito.' : 'Ok, não será feito.'
  let regraCriada = false

  if (status === 'APROVADA' && pedido.tipo === TIPO_ESCOLHA) {
    const candidatoId = (pedido.acaoProposta as { candidatoId?: string } | null)?.candidatoId
    if (!candidatoId) throw new ErroDeAprovacao(409, 'Pedido sem candidato.')
    const r = await escolherCandidato({ workspaceId: p.workspaceId, userId: p.userId, candidatoId, agora, ator: 'TITULAR' })
    mensagem = r.produtoCriado ? 'Produto escolhido e cadastrado.' : 'Produto escolhido.'
  }
  if (status === 'APROVADA' && pedido.tipo === TIPO_EXCECAO) mensagem = 'Marcado como resolvido. Se o problema voltar, o Patrono avisa de novo.'

  if (status === 'APROVADA' && p.sempre && pedido.tipo === TIPO_ESCOLHA) {
    const c = await prisma.candidatoDeProduto.findFirst({ where: { id: (pedido.acaoProposta as { candidatoId: string }).candidatoId }, select: { categoria: true, preco: true } })
    const condicao: CondicaoDaRegra = { riscoMax: (['BAIXO', 'MEDIO', 'ALTO'].includes(pedido.risco) ? pedido.risco : 'BAIXO') as CondicaoDaRegra['riscoMax'] }
    if (c?.categoria) condicao.categoriaIn = [c.categoria]
    if (typeof c?.preco === 'number') condicao.precoMax = Math.ceil(c.preco)
    await criarRegra({ workspaceId: p.workspaceId, tipo: TIPO_ESCOLHA, condicao, efeito: 'APROVAR', userId: p.userId, motivo: 'Criada em "Precisa de você" (sempre aprovar casos assim).' })
    regraCriada = true
    mensagem += ' Daqui em diante, casos assim o Patrono resolve sozinho.'
  }
  return { status: status as ResultadoDaDecisao['status'], mensagem, regraCriada }
}
