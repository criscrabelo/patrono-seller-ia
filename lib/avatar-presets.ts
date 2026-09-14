/**
 * AvatarAppearancePreset / AvatarScenePreset (Rodada 7, regra 31) — só a
 * ARQUITETURA. Nesta rodada o MVP prova "mesma pessoa + mesma voz + fala
 * natural + vídeo TikTok válido" com o vídeo de referência tal como
 * fornecido — nenhuma geração de roupa/cenário diferente acontece ainda.
 * Estes tipos existem para a evolução futura não exigir redesenho.
 */

export const AVATAR_APPEARANCE_PRESETS = ['casual', 'elegante', 'beauty', 'fashion', 'tech', 'home', 'studio'] as const
export type AvatarAppearancePreset = (typeof AVATAR_APPEARANCE_PRESETS)[number]

export const AVATAR_SCENE_PRESETS = ['casual', 'elegante', 'beauty', 'fashion', 'tech', 'home', 'studio'] as const
export type AvatarScenePreset = (typeof AVATAR_SCENE_PRESETS)[number]

/**
 * Nesta rodada, todo preset aponta para o mesmo comportamento: usar o
 * vídeo de referência como veio (identidade consistente). Nenhum preset
 * altera roupa/cenário de verdade ainda — a função existe só para o
 * restante do código já poder depender do tipo sem quebrar quando a
 * geração de aparência for implementada.
 */
export function presetAindaNaoImplementado(): { implementado: false; motivo: string } {
  return { implementado: false, motivo: 'Geração de roupa/cenário fica para uma rodada futura — MVP usa o vídeo de referência como veio.' }
}
