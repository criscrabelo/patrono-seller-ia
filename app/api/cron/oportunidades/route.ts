import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  montarFilaDeOportunidades,
  compararFilas,
  MOTOR_NAO_PUBLICA,
} from '@/lib/motor-de-oportunidades'
import { montarPlanoDeAcao, PLANO_NAO_EXECUTA } from '@/lib/plano-de-acao'
import { jobsDeGeracaoDoPlano, jobsDeLacunaDeFormato, TIPO_JOB_GERACAO } from '@/lib/fabrica-de-conteudo'
import { jobsDesejadosDoPlano } from '@/lib/automation-queue-contrato'
import { sincronizarFilaComPlano } from '@/lib/automation-queue-repositorio'
import { portaPrisma } from '@/lib/automation-queue-prisma'

/**
 * Reavaliação periódica da fila de oportunidades (P1.1).
 *
 * AUTOMATION FIRST: descobrir que um produto subiu, caiu ou apareceu não
 * pode depender de alguém abrir a tela e comparar de cabeça. O cron
 * recalcula, compara com a execução anterior e devolve só o que mudou.
 *
 * ── O ELO QUE FALTAVA ───────────────────────────────────────────────────
 * Até aqui este cron calculava o plano e o DESCARTAVA: ele voltava no JSON
 * e ninguém o enfileirava. Do outro lado, `/api/cron/executar-fila` rodava
 * a cada 30 minutos sobre uma fila que nada alimentava. A cadeia tinha
 * executor sem produtor.
 *
 * Agora o plano vira job na MESMA tabela do P1.3. É a peça que faltava
 * para a fábrica funcionar sem ninguém chamar função à mão.
 *
 * ── O QUE ESTE CRON NÃO FAZ ─────────────────────────────────────────────
 * Não publica, não cria `Publicacao`, não cria link, não chama provider
 * pago e não toca no ML. Ele lê o catálogo, planeja e enfileira trabalho
 * INTERNO e gratuito. Publicação autônoma depende do Revenue Autopilot —
 * ver `MOTOR_NAO_PUBLICA`.
 */
export const dynamic = 'force-dynamic'

/** Quantas oportunidades devolver por workspace. A fila inteira é ruído. */
const TOPO_DA_FILA = 20

/**
 * Os tipos de job que ESTE cron administra.
 *
 * A sincronização cancela o que saiu do plano — e precisa cancelar só o que
 * é dela. Sem esta lista, ela apagaria um `CONECTAR_CANAL` criado pela
 * autorização da conta só porque ele não nasceu aqui.
 */
const TIPOS_DESTE_CRON = [
  TIPO_JOB_GERACAO,
  'SINCRONIZAR_MIDIA_AUTORIZADA',
  'CONECTAR_CANAL',
  'COMPLETAR_DADO_DO_PRODUTO',
  'HABILITAR_CAPACIDADE',
] as const

/**
 * A capacidade da máquina, lida do MESMO lugar que o executor lê.
 *
 * Antes daqui saía `{ FFMPEG: true }` fixo, enquanto o executor perguntava
 * a `FFMPEG_DISPONIVEL`. As duas autoridades discordavam: o plano escolhia
 * vídeo e o executor recusava por falta de capacidade. Fail-closed e uma
 * fonte só — o que não for afirmado como disponível não é escolhido.
 */
function capacidadesDeclaradas() {
  return {
    FFMPEG: process.env.FFMPEG_DISPONIVEL === 'true',
    DIGITAL_TWIN_GPU: process.env.DIGITAL_TWIN_GPU_DISPONIVEL === 'true',
    PROVEDOR_PAGO_AUTORIZADO: false,
  }
}

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

  const porta = portaPrisma()
  const capacidades = capacidadesDeclaradas()
  const porWorkspace: Record<string, unknown> = {}
  let jobsCriados = 0
  let jobsMantidos = 0
  let jobsCancelados = 0
  let lacunasDeFormato = 0
  let totalPronta = 0
  let totalComercial = 0
  let itensDePlano = 0
  let pendenciasDeAutomacao = 0

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

    // P1.2: a fila vira PLANO. Seleção, canal, formato e próxima ação — sem
    // executar nada. As capacidades técnicas entram declaradas: o que nao
    // for afirmado como disponivel nao e escolhido.
    const plano = montarPlanoDeAcao({
      workspaceId: ws.id,
      fila,
      canaisConectados: canaisCapazes,
      capacidades,
      agora,
    })
    itensDePlano += plano.itens.length
    pendenciasDeAutomacao += plano.filaDeAutomacao.length

    // O plano vira fila. Três origens, uma tabela, uma sincronização:
    //   dependências que faltam        -> jobsDesejadosDoPlano
    //   geração que dá para fazer      -> jobsDeGeracaoDoPlano
    //   formato que a fábrica não faz  -> jobsDeLacunaDeFormato
    const lacunas = jobsDeLacunaDeFormato(ws.id, plano.itens)
    lacunasDeFormato += lacunas.length
    const desejados = [
      ...jobsDesejadosDoPlano(ws.id, plano.filaDeAutomacao),
      ...jobsDeGeracaoDoPlano(ws.id, plano.itens),
      ...lacunas,
    ]
    const sinc = await sincronizarFilaComPlano({
      porta,
      workspaceId: ws.id,
      desejados,
      agora,
      tiposGerenciados: TIPOS_DESTE_CRON,
    })
    jobsCriados += sinc.criados
    jobsMantidos += sinc.mantidos
    jobsCancelados += sinc.cancelados

    porWorkspace[ws.id] = {
      plano: {
        itens: plano.itens,
        filaDeAutomacao: plano.filaDeAutomacao,
        descartados: plano.descartados,
        custoTotal: plano.custoTotal,
      },
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
    itensDePlano,
    pendenciasDeAutomacao,
    capacidades,
    fila: {
      criados: jobsCriados,
      mantidos: jobsMantidos,
      cancelados: jobsCancelados,
      lacunasDeFormato,
    },
    // Declarado na resposta para não restar dúvida sobre o escopo.
    publicacaoAutonoma: MOTOR_NAO_PUBLICA.estado,
    execucaoAutonoma: PLANO_NAO_EXECUTA.estado,
    executadoEm: agora.toISOString(),
  })
}

/** Reexportado para quem quiser comparar duas execuções fora do cron. */
export { compararFilas }
