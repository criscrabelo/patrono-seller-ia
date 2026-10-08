import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { escolherCandidato } from '@/lib/curadoria'
import { respostaDeErro } from '@/lib/curadoria-http'

// P2.14.5.13: a titular escolhe 1 dos 3. Cadastra (ou liga) o produto e
// para aí: não gera conteúdo, não publica, não chama IA.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const r = await escolherCandidato({ workspaceId: session.user.workspaceId, userId: session.user.id, candidatoId: id })
    return NextResponse.json(r)
  } catch (e) {
    return respostaDeErro(e)
  }
}
