/**
 * P2.15.4 — Qual módulo cada rota de API serve (fonte ÚNICA da regra).
 *
 * A permissão por módulo (/admin/permissoes) valia só na tela. Agora o
 * servidor confere em `exigirSessao()` (lib/sessao.ts), usando ESTA tabela.
 * Uma rota compartilhada (ex.: GET /api/produtos, que alimenta Produtos,
 * Gerar Conteúdo, Links…) fica liberada se a usuária tiver QUALQUER um dos
 * módulos que a usam; escrita exige o módulo dono.
 *
 * Rotas fora da tabela (conta, Digital Twin, auth, admin, cron, webhooks,
 * links públicos, trabalhos longos, permissões) não dependem de módulo.
 *
 * Função pura e sem dependências: roda no middleware (edge) e no servidor.
 */
import type { ModuloKey } from './modulos'

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export interface RegraDeRota {
  /** Prefixo do caminho (sem barra final). Casa com o caminho exato ou com subcaminhos. */
  prefixo: string
  /** Métodos a que a regra se aplica (ausente = todos). */
  metodos?: Metodo[]
  /** Basta ter UM destes módulos liberado. */
  modulos: ModuloKey[]
}

const LEITURA: Metodo[] = ['GET']
const ESCRITA: Metodo[] = ['POST', 'PUT', 'PATCH', 'DELETE']

/** Do mais específico para o mais geral: a primeira que casar vale. */
export const REGRAS_DE_ROTA: RegraDeRota[] = [
  // Central (Command Center, Supervisor, Copilot) e a fila
  { prefixo: '/api/central', modulos: ['dashboard'] },
  { prefixo: '/api/supervisor', modulos: ['dashboard'] },
  { prefixo: '/api/copilot', modulos: ['dashboard'] },
  { prefixo: '/api/metricas', modulos: ['dashboard', 'relatorios'] },
  { prefixo: '/api/precisa-de-voce', modulos: ['precisa-de-voce'] },
  // Oportunidades e produtos
  { prefixo: '/api/oportunidades', modulos: ['oportunidades'] },
  { prefixo: '/api/produtos', metodos: LEITURA, modulos: ['produtos', 'produtos-imagens', 'conteudos-gerar', 'links', 'vendas-comissoes'] },
  { prefixo: '/api/produtos', metodos: ['PATCH'], modulos: ['produtos', 'produtos-imagens'] },
  { prefixo: '/api/produtos', metodos: ESCRITA, modulos: ['produtos'] },
  // Conteúdo
  { prefixo: '/api/conteudos/gerar', modulos: ['conteudos-gerar'] },
  { prefixo: '/api/conteudos', metodos: LEITURA, modulos: ['conteudos', 'aprovacao', 'calendario', 'videos', 'whatsapp', 'conteudos-gerar'] },
  { prefixo: '/api/conteudos', metodos: ['PATCH'], modulos: ['conteudos', 'aprovacao', 'conteudos-gerar'] },
  { prefixo: '/api/conteudos', metodos: ESCRITA, modulos: ['conteudos'] },
  { prefixo: '/api/video-seller', modulos: ['video-seller'] },
  { prefixo: '/api/whatsapp', modulos: ['whatsapp'] },
  // Resultados
  { prefixo: '/api/links', metodos: LEITURA, modulos: ['links', 'monetizacao', 'produtos'] },
  { prefixo: '/api/links', metodos: ['PATCH'], modulos: ['links', 'produtos'] },
  { prefixo: '/api/links', metodos: ESCRITA, modulos: ['links'] },
  { prefixo: '/api/programas/providers', modulos: ['programas'] },
  { prefixo: '/api/programas', metodos: LEITURA, modulos: ['programas', 'vendas-comissoes'] },
  { prefixo: '/api/programas', metodos: ESCRITA, modulos: ['programas'] },
  { prefixo: '/api/vendas', modulos: ['vendas-comissoes'] },
  { prefixo: '/api/comissoes', modulos: ['vendas-comissoes'] },
  // Configurações
  { prefixo: '/api/integracoes', metodos: LEITURA, modulos: ['integracoes', 'conteudos'] },
  { prefixo: '/api/integracoes', metodos: ESCRITA, modulos: ['integracoes'] },
]

/** FUNÇÃO PURA: a regra que vale para este caminho e método (null = rota sem módulo). */
export function regraDaRota(caminho: string, metodo: string): RegraDeRota | null {
  const m = metodo.toUpperCase() as Metodo
  return (
    REGRAS_DE_ROTA.find(
      (r) => (caminho === r.prefixo || caminho.startsWith(r.prefixo + '/')) && (!r.metodos || r.metodos.includes(m))
    ) ?? null
  )
}

/** FUNÇÃO PURA: com estes módulos bloqueados, a rota pode ser usada? */
export function rotaLiberada(regra: RegraDeRota | null, bloqueados: ReadonlySet<string>): boolean {
  return !regra || regra.modulos.some((m) => !bloqueados.has(m))
}

/** Cabeçalhos que o middleware grava (e sobrescreve) em toda requisição autenticada. */
export const CABECALHO_CAMINHO = 'x-patrono-caminho'
export const CABECALHO_METODO = 'x-patrono-metodo'
