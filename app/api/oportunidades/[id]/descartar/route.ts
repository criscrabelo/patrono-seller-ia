import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { descartarCandidato } from '@/lib/curadoria'
import { respostaDeErro } from '@/lib/curadoria-http'

// P2.14.5.13: a titular descarta um candidato. Fica fora das coletas por
// 30 dias; depois pode voltar a concorrer, se ainda for elegível.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    await descartarCandidato({ workspaceId: session.user.workspaceId, userId: session.user.id, candidatoId: id })
    return NextResponse.json({ success: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
