import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gerarVideoSeller } from '@/lib/claude'
import { z } from 'zod'

const schema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  publicoAlvo: z.string().min(1),
  plataforma: z.string().min(1),
  duracao: z.number().positive(),
  objetivo: z.string().min(1),
  estilo: z.string().min(1),
  comando: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { comando, ...entrada } = parsed.data

  if (comando) {
    const estiloMap: Record<string, string> = {
      anuncio: 'Direto para venda',
      premium: 'luxuoso e sofisticado',
      viral: 'viral com gancho forte e ritmo rápido',
      marketplace: 'demonstrativo e objetivo para marketplace',
      lifestyle: 'lifestyle emocional',
    }
    entrada.estilo = estiloMap[comando] ?? entrada.estilo
  }

  const output = await gerarVideoSeller(entrada)
  return NextResponse.json(output, { status: 201 })
}
