import { NextResponse } from 'next/server'
import { exigirSessaoEFlag, respostaDeErroFase1 } from '@/lib/api-fase1'
import { listarPrecisaDeVoce } from '@/lib/precisa-de-voce'

// P2.15: só o que SÓ a titular pode decidir (a fila se limpa antes de listar).
export async function GET() {
  const s = await exigirSessaoEFlag('CENTRAL_DE_APROVACOES')
  if (s instanceof NextResponse) return s
  try {
    return NextResponse.json({ itens: await listarPrecisaDeVoce(s.workspaceId) })
  } catch (e) {
    return respostaDeErroFase1(e)
  }
}
