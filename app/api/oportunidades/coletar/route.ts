import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { coletarCandidatos, listarApresentados } from '@/lib/curadoria'
import { candidatoParaTela, respostaDeErro } from '@/lib/curadoria-http'

// P2.14.5.13: coleta e ranqueia por clique da titular. Funciona com o
// workspace em MANUAL ou pausado; não muda o modo, não cria tarefa, não gera
// conteúdo, não publica.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const resumo = await coletarCandidatos({ workspaceId: session.user.workspaceId, userId: session.user.id })
    const candidatos = await listarApresentados(session.user.workspaceId)
    return NextResponse.json({ resumo, candidatos: candidatos.map(candidatoParaTela) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
