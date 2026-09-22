import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { obterDossieDaOperacao } from '@/lib/dossie-operacao'

export const dynamic = 'force-dynamic'

/**
 * Dossiê auditável de uma venda (P0.2 Bloco 5), para a tela.
 *
 * SOMENTE LEITURA. O workspace vem da SESSÃO — nunca do cliente. Venda de
 * outro negócio devolve 404, igual a venda inexistente: responder
 * "existe, mas você não pode ver" já confirmaria que ela existe.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const dossie = await obterDossieDaOperacao(session.user.workspaceId, id)
  if (!dossie) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })

  return NextResponse.json(dossie)
}
