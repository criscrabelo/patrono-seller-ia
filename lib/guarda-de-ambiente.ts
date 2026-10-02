/**
 * P2.5 — Preview e Test NUNCA falam com o banco de produção.
 *
 * Na Vercel, `DATABASE_URL` é uma variável só para Production e Preview: o
 * Preview de qualquer push abria o banco de produção (P2.3). Na Netlify, o
 * isolamento é por site e por contexto (P2.4). Esta trava é a defesa em
 * profundidade, no único lugar por onde todo acesso passa (lib/prisma.ts):
 *
 *   com `PATRONO_REF_DO_BANCO_DE_PRODUCAO` configurada, uma `DATABASE_URL`
 *   que contenha essa referência SÓ é aceita quando o ambiente é
 *   EXPLICITAMENTE produção. Preview, teste ou contexto desconhecido →
 *   recusa antes de abrir conexão.
 *
 * Sinais de produção, em ordem: `PATRONO_AMBIENTE=producao` (explícito,
 * vence os outros), `VERCEL_ENV=production`, `CONTEXT=production`
 * (Netlify).
 *
 * A referência vem do AMBIENTE, nunca do repositório. Sem ela, a trava fica
 * inerte — hoje nada muda até a variável ser configurada.
 */
export type ContextoDeImplantacao = 'producao' | 'nao-producao' | 'desconhecido'

export function contextoDeImplantacao(env: Record<string, string | undefined>): ContextoDeImplantacao {
  const explicito = (env.PATRONO_AMBIENTE ?? '').trim().toLowerCase()
  if (explicito) return explicito === 'producao' ? 'producao' : 'nao-producao'
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production' ? 'producao' : 'nao-producao'
  if (env.CONTEXT) return env.CONTEXT === 'production' ? 'producao' : 'nao-producao'
  return 'desconhecido'
}

export type VereditoDoBanco = { ok: true; trava: 'inerte' | 'ativa' } | { ok: false; explicacao: string }

export function bancoPermitidoNoAmbiente(env: Record<string, string | undefined>): VereditoDoBanco {
  const ref = (env.PATRONO_REF_DO_BANCO_DE_PRODUCAO ?? '').trim()
  if (!ref) return { ok: true, trava: 'inerte' }
  // Referência curta demais casaria com qualquer URL: configuração errada
  // não pode virar trava falsa nem passe livre.
  if (ref.length < 8) return { ok: false, explicacao: 'PATRONO_REF_DO_BANCO_DE_PRODUCAO inválida (curta demais).' }

  const url = env.DATABASE_URL ?? ''
  if (!url.includes(ref)) return { ok: true, trava: 'ativa' }

  const contexto = contextoDeImplantacao(env)
  if (contexto === 'producao') return { ok: true, trava: 'ativa' }
  return {
    ok: false,
    explicacao:
      `Banco de produção recusado: este ambiente é "${contexto}". Preview e teste usam só o banco de teste. ` +
      'Se isto É produção, declare PATRONO_AMBIENTE=producao.',
  }
}
