import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContaAtivaId } from '@/lib/conta'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const body = await req.json()
  const valor = parseFloat(body.valor)
  if (!valor || valor <= 0) {
    return NextResponse.json({ error: 'Informe um valor de venda válido' }, { status: 400 })
  }

  const link = await prisma.linkDinamico.findFirst({
    where: { id, contaId },
  })
  if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })

  // Loja própria: o valor da venda inteiro é a receita do vendedor (sem custo cadastrado).
  // Afiliado / TikTok Shop: a receita é a comissão sobre o valor vendido.
  const receitaGanha = link.tipo === 'loja-propria'
    ? valor
    : valor * ((link.comissao ?? 0) / 100)

  const atualizado = await prisma.linkDinamico.update({
    where: { id },
    data: {
      conversoes: { increment: 1 },
      receitaTotal: { increment: receitaGanha },
      ultimaAtualizacao: new Date(),
    },
  })

  return NextResponse.json(atualizado)
}
