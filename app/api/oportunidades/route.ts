import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarApresentados } from '@/lib/curadoria'
import { candidatoParaTela, respostaDeErro } from '@/lib/curadoria-http'

// P2.14.5.13: os 3 candidatos apresentados à titular. Só leitura.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const candidatos = await listarApresentados(session.user.workspaceId)
    return NextResponse.json({ candidatos: candidatos.map(candidatoParaTela) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
