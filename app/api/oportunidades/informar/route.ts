import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { CATEGORIAS } from '@/types'
import { coletarCandidatos, informarProduto, listarApresentados, ultimaColeta } from '@/lib/curadoria'
import { candidatoParaTela, respostaDeErro, ultimaColetaParaTela } from '@/lib/curadoria-http'

// P2.14.5.13: "Informar produto" — fallback, não o fluxo principal.
// Obrigatórios: nome e link. Nada é completado: o que não vier fica vazio.
const urlHttp = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Use um link http(s).')

const informadoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  link: urlHttp,
  categoria: z.enum(CATEGORIAS as [string, ...string[]]).optional().nullable(),
  preco: z.number().finite().positive().max(1_000_000).optional().nullable(),
  imagem: urlHttp.optional().nullable().or(z.literal('')),
  comprei: z.boolean().default(false),
  usei: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }
  const parsed = informadoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { workspaceId, id: userId } = session.user
    await informarProduto({ workspaceId, userId, dados: { ...parsed.data, imagem: parsed.data.imagem || null } })
    // Entra no ranking junto com o catálogo.
    const resumo = await coletarCandidatos({ workspaceId, userId })
    const [candidatos, ultima] = await Promise.all([listarApresentados(workspaceId), ultimaColeta(workspaceId)])
    return NextResponse.json(
      { resumo, candidatos: candidatos.map(candidatoParaTela), ultimaColeta: ultimaColetaParaTela(ultima) },
      { status: 201 }
    )
  } catch (e) {
    return respostaDeErro(e)
  }
}
