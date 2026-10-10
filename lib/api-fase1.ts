/**
 * P2.15 (Fase 1) — Base comum das rotas novas: sessão obrigatória, feature
 * flag por workspace (tudo nasce DESLIGADO) e erros conhecidos com status
 * próprio. Nenhuma rota recebe workspaceId do cliente: vem da sessão.
 */
import { NextResponse } from 'next/server'
import { exigirSessao } from './sessao'
import { flagLigada, type ChaveDeFlag } from './feature-flags'
import { ErroDeAprovacao } from './aprovacoes'
import { ErroDeCuradoria } from './curadoria'
import { ErroDeSeguranca } from './kill-switch'
import { ErroDeTransicao } from './supervisor/run'
import { log } from './observabilidade'

export type Sessao = { workspaceId: string; userId: string }

export async function exigirSessaoEFlag(flag: ChaveDeFlag): Promise<Sessao | NextResponse> {
  // P2.15.4: sessão + permissão de módulo pela porta única.
  const session = await exigirSessao()
  if (session instanceof NextResponse) return session
  if (!(await flagLigada(flag, session.user.workspaceId))) return NextResponse.json({ error: 'Recurso ainda não liberado.' }, { status: 404 })
  return { workspaceId: session.user.workspaceId, userId: session.user.id }
}

export function respostaDeErroFase1(e: unknown) {
  if (e instanceof ErroDeAprovacao || e instanceof ErroDeCuradoria) return NextResponse.json({ error: e.message }, { status: e.status })
  if (e instanceof ErroDeSeguranca) return NextResponse.json({ error: e.motivo }, { status: 423 })
  if (e instanceof ErroDeTransicao) return NextResponse.json({ error: e.message }, { status: 409 })
  log('error', 'api.fase1.erro', { erro: e instanceof Error ? e.message : String(e) })
  return NextResponse.json({ error: 'Erro interno. Nada foi alterado além do que já estava registrado.' }, { status: 500 })
}
