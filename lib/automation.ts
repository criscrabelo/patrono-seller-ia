/**
 * Fundação de automação (Rodada 4) — princípio "AUTOMATION FIRST".
 *
 * A experiência principal futura deve ser automática; o modo manual
 * PERMANECE como fallback (nunca removido). Nada neste arquivo dispara
 * ciclo automático de verdade — são os tipos/estados que a automação real
 * (rodadas futuras) vai usar, e que o modo manual de hoje já pode adotar
 * gradualmente sem quebrar nada.
 */

// ── Pipeline de validação de uma publicação ──────────────────────────────
// Do rascunho até publicado (ou barrado). Nomes adaptados aos status já
// usados em Conteudo/Sale quando fazem sentido; os demais são novos,
// pensados para a automação, não para substituir os atuais.
export const STATUS_PIPELINE = [
  'DRAFT',
  'GENERATED',
  'TECHNICALLY_VALID', // formato/codec/duração ok para o canal (ex.: TikTokPreflightValidator)
  'COMMERCIAL_RULES_VALID', // disclosure/termos de conteúdo comercial ok
  'CHANNEL_VALID', // aprovado pelas regras específicas do canal escolhido
  'READY_TO_PUBLISH',
  'REQUIRES_USER_CONSENT', // plataforma exige confirmação humana antes de publicar
  'BLOCKED_BY_POLICY',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
] as const
export type StatusPipeline = (typeof STATUS_PIPELINE)[number]

/**
 * IMPORTANTE: nenhum desses estados intermediários pode ser confundido com
 * "aceito pela plataforma". `TECHNICALLY_VALID`/`COMMERCIAL_RULES_VALID`
 * significam apenas que NÓS pré-validamos — nunca dizer "validado pelo
 * TikTok" (ou qualquer canal) antes de uma resposta real da API oficial.
 * Termo interno correto para a nossa própria pré-validação: PREVALIDATED.
 */
export const PREVALIDATED = 'PREVALIDATED' as const

// ── Modo de automação ─────────────────────────────────────────────────────
// Objetivo da proprietária é AUTOMATIC; cada tarefa pode individualmente
// cair para ASSISTED quando a própria plataforma exige consentimento — mas
// nunca cai para MANUAL silenciosamente. Uma queda de modo sempre registra
// o motivo (ver HumanActionRequired abaixo).
export const AUTOMATION_MODES = ['MANUAL', 'ASSISTED', 'AUTOMATIC'] as const
export type AutomationMode = (typeof AUTOMATION_MODES)[number]

// ── Fila de exceção — só para o que realmente precisa de uma pessoa ──────
// A Home futura deve mostrar "Preciso de você em 1 item", nunca
// transformar a usuária em operadora do dia a dia.
export const HUMAN_ACTION_REASONS = [
  'TIKTOK_CONSENT', // consentimento de publicação exigido pela plataforma
  'TOKEN_EXPIRED', // token de integração expirado, precisa reconectar
  'EXTERNAL_APPROVAL', // aprovação de terceiro (produtor, marca) pendente
  'PROGRAM_REGISTRATION', // cadastro em programa de afiliados exige ato pessoal
  'IDENTITY_VERIFICATION', // verificação de identidade/CPF exigida pela plataforma
  'ACCOUNT_SUSPENDED', // conta bloqueada/suspensa em algum canal ou programa
  'AMBIGUOUS_RULE', // regra de conteúdo/política ambígua, não dá pra decidir sozinho
  'MISSING_AUTHORIZED_MEDIA', // produto sem mídia autorizada para gerar conteúdo
] as const
export type HumanActionReason = (typeof HUMAN_ACTION_REASONS)[number]

export interface HumanActionRequired {
  id: string
  workspaceId: string
  reason: HumanActionReason
  entityType: string
  entityId: string
  message: string
  createdAt: Date
  resolvedAt: Date | null
}

// ── Scheduler — abstração de jobs agendados, sem serviço pago ────────────
// Nesta rodada, NENHUM job dispara publicação real automaticamente — só o
// tipo. Reaproveitar a stack existente (Postgres + Vercel Cron, já usados
// por /api/cron/publicar) quando isso for implementado de verdade; nunca
// contratar um scheduler externo pago.
export const AUTOMATION_JOB_TYPES = [
  'DISCOVER_OPPORTUNITY',
  'SCORE_OPPORTUNITY',
  'GENERATE_CREATIVE',
  'VALIDATE_CREATIVE',
  'PUBLISH_CONTENT',
  'COLLECT_METRICS',
] as const
export type AutomationJobType = (typeof AUTOMATION_JOB_TYPES)[number]

export interface AutomationJob {
  id: string
  type: AutomationJobType
  workspaceId: string
  scheduledAt: Date
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  attempts: number
  lastError: string | null
}

// ── Orquestrador ──────────────────────────────────────────────────────────
// Fundação da automação de ponta a ponta (design_handoff + Rodada 4 §17):
// descobrir oportunidade → pontuar → selecionar produto → gerar pacote
// criativo → validar → publicar → coletar métricas → aprender → repetir.
// Nesta rodada, só a interface — nenhum ciclo roda de verdade.
export interface AutomationOrchestrator {
  runCycle(workspaceId: string): Promise<{
    job: AutomationJob
    humanActionRequired: HumanActionRequired | null
  }>
}
