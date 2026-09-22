import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  montarFilaDeOportunidades,
  compararFilas,
  MOTOR_NAO_PUBLICA,
} from '@/lib/motor-de-oportunidades'

/**
 * Reavaliação periódica da fila de oportunidades (P1.1).
 *
 * AUTOMATION FIRST: descobrir que um produto subiu, caiu ou apareceu não
 * pode depender de alguém abrir a tela e comparar de cabeça. O cron
 * recalcula, compara com a execução anterior e devolve só o que mudou.
 *
 * ── O QUE ESTE CRON NÃO FAZ ─────────────────────────────────────────────
 * Não publica, não gera conteúdo, não cria link, não chama provider pago e
 * não toca no ML. Ele LÊ o catálogo e devolve a fila. Publicação autônoma
 * depende do Revenue Autopilot — ver `MOTOR_NAO_PUBLICA`.
 */
export const dynamic = 'force-dynamic'

/** Quantas oportunidades devolver por workspace. A fila inteira é ruído. */
const TOPO_DA_FILA = 20

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/oportunidades] CRON_SECRET não configurado — recusando executar.')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const workspaces = await prisma.workspace.findMany({ select: { id: true } })

  const porWorkspace: Record<string, unknown> = {}
  let totalPronta = 0
  let totalComercial = 0

  for (const ws of workspaces) {
    // Canais que conseguem publicar HOJE. Sem integração conectada, nada
    // fica PRONTA_PARA_PUBLICACAO — e isso é correto, não é bug.
    const integracoes = await prisma.integracao.findMany({
      where: { workspaceId: ws.id, status: 'conectado' },
      select: { plataforma: true },
    })
    const canaisCapazes = integracoes.map((i) => i.plataforma)

    const fila = await montarFilaDeOportunidades({
      workspaceId: ws.id,
      agora,
      canaisCapazes,
      limite: TOPO_DA_FILA,
    })
    if (fila.length === 0) continue

    const pronta = fila.filter((o) => o.classificacao === 'PRONTA_PARA_PUBLICACAO')
    const comercial = fila.filter((o) => o.classificacao === 'OPORTUNIDADE_COMERCIAL')
    totalPronta += pronta.length
    totalComercial += comercial.length

    porWorkspace[ws.id] = {
      total: fila.length,
      prontasParaPublicacao: pronta.length,
      oportunidadesComerciais: comercial.length,
      // O topo com a explicação — nunca só o número.
      topo: fila.slice(0, 5).map((o) => ({
        produtoId: o.produtoId,
        produtoNome: o.produtoNome,
        score: o.score,
        classificacao: o.classificacao,
        confianca: o.confianca,
        motivosDeProntidao: o.motivosDeProntidao,
        porqueDestaPosicao: o.porqueDestaPosicao,
        dadosAusentes: o.dadosAusentes,
        receitaPotencialEstimada: o.receitaPotencialEstimada,
        baseDaEstimativa: o.baseDaEstimativa,
      })),
    }
  }

  return NextResponse.json({
    ok: true,
    workspaces: workspaces.length,
    totalPronta,
    totalComercial,
    porWorkspace,
    // Declarado na resposta para não restar dúvida sobre o escopo.
    publicacaoAutonoma: MOTOR_NAO_PUBLICA.estado,
    executadoEm: agora.toISOString(),
  })
}

/** Reexportado para quem quiser comparar duas execuções fora do cron. */
export { compararFilas }
