import { NextRequest, NextResponse } from 'next/server'
import {
  processarWebhookTikTok,
  lerCabecalhoDeAssinatura,
  TAMANHO_MAXIMO_DO_CORPO,
  WebhookIdempotencyStoreEmMemoria,
} from '@/lib/tiktok-webhook'

// Store de idempotência do processo — suficiente para uma única instância;
// se/quando escalarmos para múltiplas instâncias, trocar por uma
// implementação baseada no Postgres já existente (AuditLog), sem serviço novo.
const store = new WebhookIdempotencyStoreEmMemoria()

/**
 * Rota PÚBLICA (exceção exata no middleware): quem chama é o servidor do
 * TikTok, sem sessão. Por isso toda recusa acontece aqui, nesta ordem, e
 * nenhuma etapa grava nada:
 *   1. app sem segredo configurado → recusa;
 *   2. cabeçalho `Tiktok-Signature` ausente ou fora do formato oficial →
 *      recusa ANTES de ler o corpo;
 *   3. corpo maior que o limite → recusa;
 *   4. assinatura, janela de tempo e JSON (lib/tiktok-webhook.ts).
 */
export async function POST(req: NextRequest) {
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientSecret) {
    return NextResponse.json({ error: 'TikTok não configurado.' }, { status: 400 })
  }

  const cabecalho = lerCabecalhoDeAssinatura(req.headers.get('tiktok-signature'))
  if (!cabecalho) {
    return NextResponse.json({ error: 'Assinatura ausente ou fora do formato oficial.' }, { status: 401 })
  }

  const declarado = Number(req.headers.get('content-length') ?? 0)
  if (declarado > TAMANHO_MAXIMO_DO_CORPO) {
    return NextResponse.json({ error: 'Corpo grande demais.' }, { status: 413 })
  }
  const corpoCru = await req.text()
  if (Buffer.byteLength(corpoCru) > TAMANHO_MAXIMO_DO_CORPO) {
    return NextResponse.json({ error: 'Corpo grande demais.' }, { status: 413 })
  }

  const resultado = await processarWebhookTikTok({
    corpoCru,
    timestampHeader: cabecalho.timestamp,
    assinaturaHeader: cabecalho.assinatura,
    clientSecret,
    store,
  })

  if (!resultado.aceito) {
    return NextResponse.json({ error: resultado.motivo }, { status: 401 })
  }
  return NextResponse.json({ ok: true, duplicado: resultado.duplicado })
}
