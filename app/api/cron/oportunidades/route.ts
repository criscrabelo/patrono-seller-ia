import { NextRequest, NextResponse } from 'next/server'
import { compararFilas, MOTOR_NAO_PUBLICA } from '@/lib/motor-de-oportunidades'
import { PLANO_NAO_EXECUTA } from '@/lib/plano-de-acao'
import { portaPrisma } from '@/lib/automation-queue-prisma'
import {
  rodarCicloDeOportunidades,
  capacidadesDeclaradas,
  CICLO_NAO_PUBLICA_NEM_GERA,
  TIPOS_DESTE_CICLO,
} from '@/lib/ciclo-de-oportunidades'

/**
 * Ciclo diário de oportunidades (P1.1 → P1.5.4).
 *
 * AUTOMATION FIRST: descobrir que um produto subiu, caiu ou apareceu não
 * pode depender de alguém abrir a tela e comparar de cabeça. O cron
 * recalcula, monta o plano e alimenta a Automation Queue.
 *
 * ── DOIS MODOS, UM CAMINHO ──────────────────────────────────────────────
 *   ?modo=ensaio  → percorre tudo e NÃO grava. É o ensaio de produção.
 *   (padrão)      → percorre tudo e grava a sincronização da fila.
 *
 * A diferença entre os dois é a última linha de cada workspace. Leitura,
 * pontuação, plano, formatos e a decisão de criar, manter e cancelar são
 * idênticas — um ensaio que rodasse código diferente mediria o ensaio, não
 * a operação.
 *
 * ── O QUE ESTE CRON NÃO FAZ ─────────────────────────────────────────────
 * Não publica, não cria `Publicacao`, não chama adapter de canal, não
 * chama provider pago e não gera conteúdo. Ele lê o catálogo, planeja e
 * enfileira trabalho INTERNO e gratuito. Gerar é do executor; publicar
 * depende do preflight e de um adapter ligado — ver `MOTOR_NAO_PUBLICA`.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Fail-closed: sem segredo configurado, ninguém roda. Não há modo aberto.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/oportunidades] CRON_SECRET não configurado — recusando executar.')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // O ensaio é explícito e opt-in; o padrão é a operação real, para que
  // ninguém descubra tarde demais que o cron diário só ensaiava.
  const modo = (new URL(req.url).searchParams.get('modo') ?? '').trim().toLowerCase()
  const ensaio = modo === 'ensaio' || modo === 'dry'

  const agora = new Date()
  const relatorio = await rodarCicloDeOportunidades({
    porta: portaPrisma(),
    agora,
    escrever: !ensaio,
  })

  return NextResponse.json({
    ok: true,
    modo: ensaio ? 'ENSAIO — nada gravado' : 'OPERACAO — fila sincronizada',
    ...relatorio,
    tiposAdministrados: TIPOS_DESTE_CICLO,
    // Declarado na resposta para não restar dúvida sobre o escopo.
    escopo: CICLO_NAO_PUBLICA_NEM_GERA.naoFaz,
    publicacaoAutonoma: MOTOR_NAO_PUBLICA.estado,
    execucaoAutonoma: PLANO_NAO_EXECUTA.estado,
  })
}

/** Reexportados para quem quiser comparar execuções fora do cron. */
export { compararFilas, capacidadesDeclaradas }
