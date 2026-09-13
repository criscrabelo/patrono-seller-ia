import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarProviders } from '@/lib/affiliate-providers'
import { capacidadeOuDesconhecida } from '@/lib/affiliate-provider-capabilities'

// Catálogo de providers conhecidos (AffiliateProviderRegistry) + a
// capacidade real de cada um (AffiliateProviderCapability) — dado público,
// igual para todo mundo, sem nada específico da usuária. A UI/automação
// deve CONSULTAR isto, nunca hardcodar comportamento por plataforma.
// Ainda exige sessão só para manter o padrão "negar por padrão" do projeto.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const providers = listarProviders().map((provider) => ({
    ...provider,
    capability: capacidadeOuDesconhecida(provider.id),
  }))

  return NextResponse.json(providers)
}
