import { NextRequest, NextResponse } from 'next/server'
import { processarWebhookTikTok, WebhookIdempotencyStoreEmMemoria } from '@/lib/tiktok-webhook'

// Store de idempotência do processo — suficiente para uma única instância;
// se/quando escalarmos para múltiplas instâncias, trocar por uma
// implementação baseada no Postgres já existente (AuditLog), sem serviço novo.
const store = new WebhookIdempotencyStoreEmMemoria()

export async function POST(req: NextRequest) {
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientSecret) {
    return NextResponse.json({ error: 'TikTok não configurado.' }, { status: 400 })
  }

  const assinaturaHeader = req.headers.get('tiktok-signature')
  const timestampHeader = req.headers.get('tiktok-timestamp')
  if (!assinaturaHeader || !timestampHeader) {
    return NextResponse.json({ error: 'Headers de assinatura ausentes.' }, { status: 401 })
  }

  const corpoCru = await req.text()
  const resultado = await processarWebhookTikTok({
    corpoCru,
    timestampHeader,
    assinaturaHeader,
    clientSecret,
    store,
  })

  if (!resultado.aceito) {
    return NextResponse.json({ error: resultado.motivo }, { status: 401 })
  }
  return NextResponse.json({ ok: true, duplicado: resultado.duplicado })
}
