import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarProviders } from '@/lib/affiliate-providers'

// Catálogo de providers conhecidos (AffiliateProviderRegistry) — dado
// público, igual para todo mundo, sem nada específico da usuária. Ainda
// exige sessão só para manter o padrão "negar por padrão" do projeto.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  return NextResponse.json(listarProviders())
}
