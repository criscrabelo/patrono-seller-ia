// Configurações da loja / vínculos externos
// Para trocar o perfil do Instagram, defina NEXT_PUBLIC_LINK_COMPRA no .env
// ou edite o valor padrão abaixo.

export const LINK_COMPRA =
  process.env.NEXT_PUBLIC_LINK_COMPRA || 'https://www.instagram.com/clickboracomprar'

export const NOME_LOJA = process.env.NEXT_PUBLIC_NOME_LOJA || 'Bora Comprar'

// Quantas vezes a IA tenta refazer o conteúdo para eliminar alertas de compliance
export const MAX_TENTATIVAS_COMPLIANCE = 3
