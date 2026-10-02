/**
 * Os executores reais, por tipo. Só a Background Function importa o mapa
 * inteiro; cada rota importa apenas o executor que usa — assim o cron de
 * publicação não passa a alcançar o fal.ai pelo grafo de imports.
 */
import type { ExecutorDeTrabalho, TipoDeTrabalhoLongo } from '../trabalho-longo'
import { executorDaLegenda } from './legenda-video'
import { executorDaPublicacao } from './publicar-instagram'
import { executorDoEnvio } from './envio-whatsapp'

export const EXECUTORES_REAIS: Record<TipoDeTrabalhoLongo, ExecutorDeTrabalho> = {
  LONGO_LEGENDA_VIDEO: executorDaLegenda(),
  LONGO_PUBLICAR_INSTAGRAM: executorDaPublicacao(),
  LONGO_ENVIO_WHATSAPP: executorDoEnvio(),
}
