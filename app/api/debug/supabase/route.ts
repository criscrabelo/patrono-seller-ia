import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Diagnóstico das envs do Supabase — não expõe valores, só formato.
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: url
      ? { ok: true, valor: url, ehPlaceholder: url.includes('placeholder') }
      : { ok: false, motivo: 'não definida' },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon
      ? { ok: true, tamanho: anon.length, prefixo: anon.slice(0, 6), ehPlaceholder: anon === 'placeholder' }
      : { ok: false, motivo: 'não definida' },
    SUPABASE_SERVICE_ROLE_KEY: service
      ? { ok: true, tamanho: service.length, prefixo: service.slice(0, 6), ehPlaceholder: service === 'placeholder' }
      : { ok: false, motivo: 'NÃO definida — esse é o problema do upload' },
  })
}
