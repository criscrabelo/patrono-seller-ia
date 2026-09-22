import { NextRequest, NextResponse } from 'next/server'
import { fecharJanelasDeObservacao, lerPoliticaDeObservacao } from '@/lib/ml-captura-publicacao'

/**
 * GATILHO D (P0.2 Bloco 4.1) — fecha a janela de observação.
 *
 * Conteúdo publicado há mais do que a janela e que não teve NENHUMA venda é
 * rotulado como não convertido. É a única fonte de amostras negativas do
 * sistema — sem elas o modelo só veria acertos.
 *
 * Na dúvida, não rotula: se houver qualquer venda não cancelada ligada ao
 * conteúdo, a amostra fica sem rótulo em vez de virar um negativo errado.
 *
 * Idempotente: só examina amostras `labeledAt: null`, então rodar de novo
 * não cria linha nem reescreve rótulo.
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Mesmo padrão dos outros crons: sem sessão de usuária, mas NUNCA aberto.
  // Sem `CRON_SECRET` configurado a rota se recusa a rodar, em vez de ficar
  // pública por omissão.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/ml-janela-observacao] CRON_SECRET não configurado — recusando executar.')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const politica = lerPoliticaDeObservacao()
  const resultado = await fecharJanelasDeObservacao({ agora })

  return NextResponse.json({
    ok: true,
    janela: {
      dias: politica.dias,
      origem: politica.origem,
      // Explícito para ninguém confundir política interna com regra oficial.
      oficialDeProvider: politica.oficialDeProvider,
    },
    ...resultado,
    executadoEm: agora.toISOString(),
  })
}
