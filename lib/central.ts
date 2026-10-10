/**
 * P2.15 (Fase 1) — Command Center: o estado da operação numa leitura só.
 *
 * Responde, nesta ordem, o que a titular precisa saber ao abrir o Patrono:
 *   1. o que o Patrono está fazendo / fez por último (SupervisorRun);
 *   2. o que precisa dela (fila "Precisa de você");
 *   3. o que aconteceu hoje (Event Ledger, em linguagem simples);
 *   4. decisões recentes, com o porquê (Decision Ledger);
 *   5. saúde das integrações e travas de segurança;
 *   6. resultado financeiro (vendas e comissões — fonte única);
 *   7. a próxima melhor ação (uma só).
 * Todas as leituras saem em paralelo: cada ida ao banco custa caro.
 */
import type { DomainEvent } from '@prisma/client'
import { prisma } from './prisma'
import { contarPrecisaDeVoce } from './precisa-de-voce'
import { estadoDeExecucao } from './kill-switch'
import { politicaAtiva } from './politica'
import { resumoComissoes, resumoVendas } from './vendas-comissoes'

const DIA = 24 * 60 * 60 * 1000
/** Início do dia em Brasília (UTC−3, sem horário de verão desde 2019). */
export function inicioDoDiaEmBrasilia(agora: Date): Date {
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0))
}

/** FUNÇÃO PURA: evento do ledger → frase para a titular (null = ruído técnico, não mostra). */
export function frasesDoEvento(e: Pick<DomainEvent, 'tipo' | 'payload'>): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>
  switch (e.tipo) {
    case 'CANDIDATES_PRESENTED': {
      const n = Array.isArray(p.chaves) ? p.chaves.length : null
      return `Analisou ${p.avaliados ?? 'os'} produto(s) e separou ${n ?? 'os'} melhores.`
    }
    case 'PRODUCT_SELECTED':
      return 'Um produto foi escolhido para o próximo conteúdo.'
    case 'APPROVAL_REQUIRED':
      return 'Pediu uma decisão sua.'
    case 'APPROVAL_GRANTED':
      return 'Uma decisão foi aprovada.'
    case 'APPROVAL_REJECTED':
      return 'Uma sugestão foi recusada.'
    case 'SAFE_MODE_ENTERED':
      return 'Entrou em modo de segurança (só observa).'
    case 'SAFE_MODE_EXITED':
      return 'Saiu do modo de segurança.'
    case 'POLICY_CHANGED':
      return 'As regras e limites foram atualizados.'
    case 'COST_BLOCKED':
      return 'Bloqueou um gasto que não estava autorizado.'
    case 'COST_RESERVED':
      return 'Reservou orçamento para uma operação autorizada.'
    case 'CONTENT_PUBLISHED':
      return 'Publicou um conteúdo.'
    case 'ERROR_DETECTED':
      return 'Encontrou um erro e parou com segurança.'
    case 'RUN_STATE_CHANGED':
      return p.para === 'CONCLUIDO' ? 'Concluiu um ciclo de trabalho.' : p.para === 'FALHOU' ? 'Um ciclo de trabalho falhou.' : null
    default:
      return null
  }
}

export type SaudeDaIntegracao = { plataforma: string; estado: 'OK' | 'ATENCAO' | 'PROBLEMA' | 'DESCONECTADA'; detalhe: string }

/** FUNÇÃO PURA. */
export function saudeDasIntegracoes(lista: { plataforma: string; status: string; tokenExpiry: Date | null }[], agora: Date): SaudeDaIntegracao[] {
  return lista.map((i) => {
    if (i.status !== 'conectado') return { plataforma: i.plataforma, estado: 'DESCONECTADA', detalhe: 'Não conectada.' }
    if (!i.tokenExpiry) return { plataforma: i.plataforma, estado: 'OK', detalhe: 'Conectada.' }
    const dias = Math.ceil((i.tokenExpiry.getTime() - agora.getTime()) / DIA)
    if (dias <= 0) return { plataforma: i.plataforma, estado: 'PROBLEMA', detalhe: 'Acesso expirado.' }
    if (dias <= 15) return { plataforma: i.plataforma, estado: 'ATENCAO', detalhe: `Acesso vence em ${dias} dia(s).` }
    return { plataforma: i.plataforma, estado: 'OK', detalhe: `Conectada (acesso válido por mais ${dias} dias).` }
  })
}

export interface ProximaAcao { texto: string; link: string | null; comando: string | null }

/** FUNÇÃO PURA: a UMA próxima melhor ação. */
export function proximaMelhorAcao(p: { pendencias: number; bloqueado: boolean; motivoDoBloqueio?: string; ultimoCicloHa: number | null; integracoesComProblema: number }): ProximaAcao {
  if (p.pendencias > 0) return { texto: `Responder ${p.pendencias} decisão(ões) que só você pode tomar.`, link: '/precisa-de-voce', comando: null }
  if (p.integracoesComProblema > 0) return { texto: 'Resolver o acesso de uma integração.', link: '/integracoes', comando: null }
  if (p.ultimoCicloHa === null || p.ultimoCicloHa > DIA) return { texto: 'Pedir ao Patrono para analisar os produtos agora.', link: null, comando: 'rodar' }
  return { texto: 'Nada pendente. O Patrono está em dia.', link: null, comando: null }
}

export async function painelCentral(workspaceId: string, agora = new Date()) {
  const hoje = inicioDoDiaEmBrasilia(agora)
  const [ultimoRun, pendencias, eventosHoje, decisoes, integracoes, seguranca, politica, vendas, comissoes] = await Promise.all([
    prisma.supervisorRun.findFirst({ where: { workspaceId }, orderBy: { iniciadoEm: 'desc' } }),
    contarPrecisaDeVoce(workspaceId, agora),
    prisma.domainEvent.findMany({ where: { workspaceId, ocorridoEm: { gte: hoje } }, orderBy: { ocorridoEm: 'desc' }, take: 40, select: { tipo: true, payload: true, ocorridoEm: true } }),
    prisma.decisionRecord.findMany({ where: { workspaceId }, orderBy: { criadoEm: 'desc' }, take: 5, select: { id: true, tipo: true, ator: true, decisao: true, explicacao: true, criadoEm: true } }),
    prisma.integracao.findMany({ where: { workspaceId }, select: { plataforma: true, status: true, tokenExpiry: true } }),
    estadoDeExecucao(workspaceId),
    politicaAtiva(workspaceId),
    resumoVendas(workspaceId),
    resumoComissoes(workspaceId),
  ])
  const saude = saudeDasIntegracoes(integracoes, agora)
  const checkpoint = (ultimoRun?.checkpoint ?? {}) as Record<string, unknown>
  const atividade = eventosHoje
    .map((e) => ({ quando: e.ocorridoEm.toISOString(), texto: frasesDoEvento(e) }))
    .filter((a): a is { quando: string; texto: string } => !!a.texto)
    .slice(0, 12)
  return {
    patrono: {
      modo: politica.regras.autonomia.padrao,
      politicaVersao: politica.versao,
      bloqueado: seguranca.acoesIrreversiveisBloqueadas,
      safeMode: seguranca.safeMode,
      motivoDoBloqueio: seguranca.motivoDoBloqueio ?? null,
      ultimoCiclo: ultimoRun
        ? { estado: ultimoRun.estado, quando: ultimoRun.iniciadoEm.toISOString(), resumo: Array.isArray(checkpoint.resumo) ? (checkpoint.resumo as string[]) : [] }
        : null,
    },
    pendencias,
    atividadeHoje: atividade,
    decisoesRecentes: decisoes.map((d) => ({ ...d, criadoEm: d.criadoEm.toISOString() })),
    integracoes: saude,
    financeiro: { vendas, comissoes },
    proximaAcao: proximaMelhorAcao({
      pendencias,
      bloqueado: seguranca.acoesIrreversiveisBloqueadas,
      motivoDoBloqueio: seguranca.motivoDoBloqueio,
      ultimoCicloHa: ultimoRun ? agora.getTime() - ultimoRun.iniciadoEm.getTime() : null,
      integracoesComProblema: saude.filter((s) => s.estado === 'PROBLEMA' || s.estado === 'ATENCAO').length,
    }),
  }
}
export type PainelCentral = Awaited<ReturnType<typeof painelCentral>>
