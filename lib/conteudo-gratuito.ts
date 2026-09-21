/**
 * Geração de conteúdo SEM IA paga (revisão do P0.1).
 *
 * Mapear o fallback não bastava: `escolherFallback()` devolvia o NOME da
 * alternativa, e nada a executava. Na prática, bloquear a Anthropic
 * significava não gerar conteúdo nenhum — o que empurraria a proprietária a
 * escrever tudo à mão, exatamente a rotina manual que a regra proíbe.
 *
 * Este módulo é o caminho gratuito de verdade: monta um `ConteudoGerado`
 * completo a partir do preset determinístico que já existe
 * (`gerarPresetTikTokDigitalTwinV1`), somado aos dados reais do produto.
 *
 * O que ele NÃO faz, e isso é deliberado:
 *  - não inventa benefício, ponto negativo, nota ou veredito. Campos que
 *    dependem de julgamento sobre o produto vêm do cadastro ou ficam vazios;
 *  - não escreve narração livre. É a única peça sem equivalente gratuito, e
 *    por isso está registrada na Automation Queue como dívida de automação,
 *    não como tarefa recorrente.
 *
 * Custo: R$ 0,00. Nenhuma chamada de rede.
 */

import { gerarPresetTikTokDigitalTwinV1 } from './digital-twin-tiktok-preset'
import type { ConteudoGerado } from '@/types'

export interface ProdutoParaConteudoGratuito {
  nome: string
  categoria: string
  preco?: number | null
  beneficios?: string[]
  pontosNegativos?: string[]
  atualizadoEm?: Date
}

export interface ResultadoConteudoGratuito {
  conteudo: ConteudoGerado
  /** Campos que a versão gratuita deixa vazios, e por quê. */
  limitacoes: string[]
}

export function gerarConteudoGratuito(produto: ProdutoParaConteudoGratuito): ResultadoConteudoGratuito {
  const preset = gerarPresetTikTokDigitalTwinV1({
    produto: {
      nome: produto.nome,
      categoria: produto.categoria,
      preco: produto.preco ?? null,
      precoConsultadoEm: (produto.atualizadoEm ?? new Date()).toLocaleDateString('pt-BR'),
      isAffiliate: true,
    },
    produtoVisivelNoAsset: false,
    usaAvatarSintetico: false,
    usaVozClonada: false,
    usaLipSync: false,
  })

  const limitacoes: string[] = []

  if (!preset.aprovado || !preset.pacote) {
    // O preset reprova quando o texto violaria Presenter Mode/unboxing. Nesse
    // caso não há conteúdo gratuito possível — e inventar um seria pior.
    throw new Error(`Conteúdo gratuito não pôde ser gerado: ${preset.motivo}`)
  }

  const pacote = preset.pacote
  const legendaCompleta = [pacote.caption, pacote.disclosure, pacote.hashtags.join(' ')]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join('\n\n')

  limitacoes.push('Narração livre não é gerada sem IA paga — use o roteiro do preset ou escreva a narração.')
  if (!produto.beneficios?.length) limitacoes.push('Benefícios não foram inferidos: vêm do cadastro do produto.')
  if (!produto.pontosNegativos?.length) limitacoes.push('Pontos negativos não foram inferidos: vêm do cadastro do produto.')

  const conteudo: ConteudoGerado = {
    // O "roteiro" gratuito é a sequência determinística hook → caption → CTA.
    roteiro: [pacote.hooks[0], pacote.caption, pacote.cta].join('\n\n'),
    legendaTiktok: legendaCompleta,
    legendaInstagram: legendaCompleta,
    legendaYoutube: legendaCompleta,
    legendaWhatsapp: `${pacote.caption}\n\n${pacote.cta}`,
    legendaFacebook: legendaCompleta,
    legendaMarketplace: pacote.caption,
    hashtags: pacote.hashtags,
    textoTela: pacote.hooks[0],
    // Vazio de propósito: sem equivalente gratuito. Dívida de automação.
    narracao: '',
    trilhaSugerida: '',
    promptVideoIA: '',
    promptCurto: '',
    chamadaAcao: pacote.cta,
    // Zero aqui significa "não avaliado", não "produto ruim". Nota é
    // julgamento sobre o produto, e a versão gratuita não julga.
    notaProduto: 0,
    pontosPositivos: produto.beneficios ?? [],
    pontosNegativos: produto.pontosNegativos ?? [],
    veredito: 'Gerado sem IA paga — avaliação do produto não foi feita automaticamente.',
    alertasCompliance: [],
  }

  return { conteudo, limitacoes }
}
