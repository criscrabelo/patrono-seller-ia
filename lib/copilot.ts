/**
 * P2.15 (Fase 1) — Copilot determinístico (custo zero, sem IA paga).
 *
 *   texto → Interpretador → Comando tipado → executor → resposta
 *
 * O interpretador é uma interface: hoje, regras e sinônimos em português;
 * amanhã, um LLM pode ocupar o mesmo lugar SEM mudar comandos nem
 * permissões. O Copilot nunca tem atalho que a tela não tenha: toda ação
 * passa pelos mesmos motores (política, travas, aprovação, ledger).
 */
import { painelCentral } from './central'
import { decidirPrecisaDeVoce, listarPrecisaDeVoce } from './precisa-de-voce'
import { executarCiclo } from './supervisor/ciclo'
import { entrarEmSafeMode, sairDoSafeMode } from './kill-switch'
import { listarApresentados } from './curadoria'

export type Comando =
  | { tipo: 'AJUDA' }
  | { tipo: 'STATUS' }
  | { tipo: 'PENDENCIAS' }
  | { tipo: 'HOJE' }
  | { tipo: 'PORQUE'; alvo: string | null }
  | { tipo: 'RODAR' }
  | { tipo: 'DECIDIR'; decisao: 'APROVAR' | 'REJEITAR'; numero: number }
  | { tipo: 'PAUSAR' }
  | { tipo: 'RETOMAR' }
  | { tipo: 'INTEGRACOES' }
  | { tipo: 'RESULTADO' }
  | { tipo: 'DESCONHECIDO'; texto: string }

export interface Interpretador {
  interpretar(texto: string): Comando
}

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Interpretador por regras (PT-BR). Ordem importa: o mais específico primeiro. */
export const interpretadorDeterministico: Interpretador = {
  interpretar(texto: string): Comando {
    const t = normalizar(texto)
    if (!t) return { tipo: 'AJUDA' }
    const decidir = t.match(/^(aprova|aprovar|aprove|sim|rejeita|rejeitar|rejeite|recusar|recusa|nao)\s*(?:o|a|item|pedido|numero|n)?\s*(\d+)$/)
    if (decidir) return { tipo: 'DECIDIR', decisao: /^(aprov|sim)/.test(decidir[1]) ? 'APROVAR' : 'REJEITAR', numero: Number(decidir[2]) }
    if (/\b(ajuda|comandos|o que voce (sabe|consegue) fazer|como (te )?uso)\b/.test(t)) return { tipo: 'AJUDA' }
    if (/\b(pausa|pausar|parar tudo|para tudo|modo de seguranca|safe mode|emergencia)\b/.test(t)) return { tipo: 'PAUSAR' }
    if (/\b(retomar|retoma|sair do (modo de seguranca|safe mode)|voltar a trabalhar|despausar)\b/.test(t)) return { tipo: 'RETOMAR' }
    if (/\b(rodar|roda|rode|atualizar|atualiza|buscar|busca|coletar|analisar|analisa|procurar)\b/.test(t)) return { tipo: 'RODAR' }
    const porque = t.match(/\b(por ?que|porque|explica|explique|motivo)\b\s*(.*)$/)
    if (porque) {
      const alvo = porque[2].replace(/^(o|a|do|da|de|este|esse|esta|essa|produto|escolheu|recomendou|recomenda)\s+/g, '').trim()
      return { tipo: 'PORQUE', alvo: alvo || null }
    }
    if (/\b(precisa de mim|pendenc\w*|pendente\w*|aprovac\w*|aprovar|decis(ao|oes) minha|o que falta)/.test(t)) return { tipo: 'PENDENCIAS' }
    if (/\b(hoje|o que (voce )?fez|o que aconteceu|atividade)\b/.test(t)) return { tipo: 'HOJE' }
    if (/\b(integra\w*|conex\w*|conectad\w*|instagram|tiktok|hotmart|shopee|token\w*|acesso\w*)\b/.test(t)) return { tipo: 'INTEGRACOES' }
    if (/\b(vendas?|comiss\w*|resultado\w*|dinheiro|faturamento|ganhei|receita\w*)\b/.test(t)) return { tipo: 'RESULTADO' }
    if (/\b(status|situacao|como (esta|vai)|o que (voce )?esta fazendo|tudo bem)\b/.test(t)) return { tipo: 'STATUS' }
    return { tipo: 'DESCONHECIDO', texto }
  },
}

export interface RespostaDoCopilot {
  comando: Comando['tipo']
  texto: string[]
  sugestoes: string[]
  /** true quando o comando mudou algo (a tela deve recarregar). */
  alterou: boolean
}

export const SUGESTOES_PADRAO = ['Como está a operação?', 'O que precisa de mim?', 'O que você fez hoje?', 'Por que este produto?', 'Rodar agora']

const AJUDA = [
  'Posso responder e agir, sempre dentro das suas regras:',
  '• "como está?" — situação do Patrono;',
  '• "o que precisa de mim?" — decisões pendentes, numeradas;',
  '• "aprovar 1" / "rejeitar 1" — decide um pedido da lista;',
  '• "o que você fez hoje?" — atividade do dia;',
  '• "por que este produto?" — explica a recomendação atual;',
  '• "rodar agora" — analisa os produtos e recomenda (não publica);',
  '• "integrações" — saúde das conexões;',
  '• "resultado" — vendas e comissões;',
  '• "pausar" / "retomar" — modo de segurança.',
]

export async function executarComando(comando: Comando, ctx: { workspaceId: string; userId: string; agora?: Date }): Promise<RespostaDoCopilot> {
  const agora = ctx.agora ?? new Date()
  const r = (texto: string[], alterou = false, sugestoes = SUGESTOES_PADRAO): RespostaDoCopilot => ({ comando: comando.tipo, texto, sugestoes, alterou })

  switch (comando.tipo) {
    case 'AJUDA':
      return r(AJUDA)
    case 'STATUS': {
      const p = await painelCentral(ctx.workspaceId, agora)
      const linhas = [
        p.patrono.bloqueado ? `Estou travado com segurança: ${p.patrono.motivoDoBloqueio}` : `Estou operando no modo ${p.patrono.modo}.`,
        p.patrono.ultimoCiclo ? `Último ciclo: ${p.patrono.ultimoCiclo.estado.toLowerCase()} — ${p.patrono.ultimoCiclo.resumo.join(' ') || 'sem resumo'}` : 'Ainda não rodei nenhum ciclo.',
        p.pendencias ? `${p.pendencias} decisão(ões) esperando você.` : 'Nada esperando você.',
        `Próximo passo: ${p.proximaAcao.texto}`,
      ]
      return r(linhas)
    }
    case 'PENDENCIAS': {
      const itens = await listarPrecisaDeVoce(ctx.workspaceId, agora)
      if (!itens.length) return r(['Nada precisa de você agora. O resto o Patrono está cuidando.'])
      return r(
        [`${itens.length} decisão(ões) sua(s):`, ...itens.map((i, n) => `${n + 1}. ${i.titulo} — ${i.resumo}`), 'Responda "aprovar 1" ou "rejeitar 1".'],
        false,
        itens.slice(0, 2).flatMap((_, n) => [`aprovar ${n + 1}`, `rejeitar ${n + 1}`])
      )
    }
    case 'DECIDIR': {
      const itens = await listarPrecisaDeVoce(ctx.workspaceId, agora)
      const alvo = itens[comando.numero - 1]
      if (!alvo) return r([`Não há o pedido ${comando.numero}. Diga "o que precisa de mim?" para ver a lista atual.`])
      const res = await decidirPrecisaDeVoce({ workspaceId: ctx.workspaceId, userId: ctx.userId, id: alvo.id, decisao: comando.decisao, agora })
      return r([`"${alvo.titulo}": ${res.status === 'APROVADA' ? 'aprovado' : 'recusado'}. ${res.mensagem}`], true)
    }
    case 'HOJE': {
      const p = await painelCentral(ctx.workspaceId, agora)
      if (!p.atividadeHoje.length) return r(['Hoje ainda não fiz nada. Diga "rodar agora" para eu analisar os produtos.'])
      return r(p.atividadeHoje.map((a) => `${new Date(a.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} — ${a.texto}`))
    }
    case 'PORQUE': {
      const apresentados = await listarApresentados(ctx.workspaceId)
      if (!apresentados.length) return r(['Ainda não há recomendação. Diga "rodar agora".'])
      const alvoNorm = comando.alvo ? normalizar(comando.alvo) : null
      const c = (alvoNorm && apresentados.find((a) => normalizar(a.nome).includes(alvoNorm))) || apresentados[0]
      return r([`${c.posicao}º ${c.nome} (nota ${c.score}, confiança ${String(c.confianca).toLowerCase().replace(/_/g, ' ')}):`, ...(c.porqueDestaPosicao ?? []).slice(0, 4), ...(c.riscos?.length ? [`Riscos: ${c.riscos.join('; ')}`] : [])])
    }
    case 'RODAR': {
      const res = await executarCiclo({ workspaceId: ctx.workspaceId, userId: ctx.userId, gatilho: 'COPILOT', agora })
      return r(res.resumo.length ? res.resumo : ['Ciclo concluído.'], true)
    }
    case 'PAUSAR': {
      const res = await entrarEmSafeMode({ workspaceId: ctx.workspaceId, motivo: 'Pedido da titular pelo Copilot.', ator: 'TITULAR', userId: ctx.userId, agora })
      return r([res.mudou ? 'Entrei em modo de segurança: continuo observando, mas não publico nem gasto nada.' : 'Já estou em modo de segurança.'], res.mudou)
    }
    case 'RETOMAR': {
      const res = await sairDoSafeMode({ workspaceId: ctx.workspaceId, userId: ctx.userId, motivo: 'Pedido da titular pelo Copilot.', agora })
      return r([res.mudou ? 'Saí do modo de segurança.' : 'Não estou em modo de segurança.'], res.mudou)
    }
    case 'INTEGRACOES': {
      const p = await painelCentral(ctx.workspaceId, agora)
      if (!p.integracoes.length) return r(['Nenhuma integração conectada ainda. Veja em Integrações.'])
      return r(p.integracoes.map((i) => `${i.plataforma}: ${i.detalhe}`))
    }
    case 'RESULTADO': {
      const p = await painelCentral(ctx.workspaceId, agora)
      const c = p.financeiro.comissoes as { prevista: number; confirmada: number; recebida: number }
      const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      return r([`Comissões — prevista: ${brl(c.prevista)} · confirmada: ${brl(c.confirmada)} · recebida: ${brl(c.recebida)}.`])
    }
    case 'DESCONHECIDO':
    default:
      return r(['Não entendi esse pedido. Tente uma destas:'], false)
  }
}

export async function perguntarAoCopilot(texto: string, ctx: { workspaceId: string; userId: string; agora?: Date }, interpretador: Interpretador = interpretadorDeterministico) {
  const comando = interpretador.interpretar(texto)
  return executarComando(comando, ctx)
}

