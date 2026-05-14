import Anthropic from '@anthropic-ai/sdk'
import type { ConteudoGerado, VideoSellerOutput, AlertaCompliance } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-6'

// ─── Geração principal de conteúdo ───────────────────────────────────────────

export interface ProdutoParaGeracao {
  nome: string
  preco?: number | null
  categoria: string
  publicoAlvo: string[]
  tipoVenda: string
  origemConteudo: string
  descricao?: string
  observacoes?: string
  beneficios: string[]
  pontosNegativos: string[]
}

export interface ConfiguracaoGeracao {
  redeSocial: string
  duracao: number
  estilo: string
  objetivo: string
}

export async function gerarConteudo(
  produto: ProdutoParaGeracao,
  config: ConfiguracaoGeracao
): Promise<ConteudoGerado> {
  const userPrompt = `Crie conteúdo comercial para o seguinte produto:

PRODUTO: ${produto.nome}
PREÇO: Dinâmico — não mencionar valor fixo (usar "clica no link", "preço de hoje no link", etc.)
CATEGORIA: ${produto.categoria}
PÚBLICO-ALVO: ${produto.publicoAlvo.join(', ')}
TIPO DE VENDA: ${produto.tipoVenda}
ORIGEM DO CONTEÚDO: ${produto.origemConteudo}
DESCRIÇÃO: ${produto.descricao || 'Não informada'}
OBSERVAÇÕES: ${produto.observacoes || 'Nenhuma'}
BENEFÍCIOS: ${produto.beneficios.join(' | ')}
PONTOS NEGATIVOS: ${produto.pontosNegativos.join(' | ')}

CONFIGURAÇÕES:
REDE SOCIAL: ${config.redeSocial}
DURAÇÃO: ${config.duracao} segundos
ESTILO: ${config.estilo}
OBJETIVO: ${config.objetivo}

Retorne JSON com exatamente estes campos:
{
  "roteiro": "string com roteiro cena a cena",
  "legendaTiktok": "string",
  "legendaInstagram": "string",
  "legendaYoutube": "string",
  "legendaWhatsapp": "string",
  "legendaMarketplace": "string",
  "hashtags": ["string"],
  "textoTela": "string",
  "narracao": "string",
  "trilhaSugerida": "string",
  "promptVideoIA": "string em inglês detalhado para Runway/Kling/Pika",
  "promptCurto": "string em inglês versão curta",
  "chamadaAcao": "string",
  "notaProduto": 8.5,
  "pontosPositivos": ["string"],
  "pontosNegativos": ["string"],
  "veredito": "string",
  "alertasCompliance": [
    {
      "tipo": "publicidade|copyright|ia|enganoso|plataforma",
      "mensagem": "string",
      "severidade": "verde|amarelo|vermelho",
      "acaoRecomendada": "string"
    }
  ]
}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `Você é o Patrono Seller IA, especialista em criação de conteúdo comercial para redes sociais brasileiras.
Crie conteúdo persuasivo, honesto e adequado para cada plataforma.
Retorne APENAS JSON válido, sem markdown, sem explicações, sem blocos de código.
O JSON deve ser parseável diretamente com JSON.parse().`,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned) as ConteudoGerado
  } catch {
    throw new Error('Falha ao interpretar resposta da IA. Tente novamente.')
  }
}

// ─── Video Seller ─────────────────────────────────────────────────────────────

export interface EntradaVideoSeller {
  nome: string
  descricao?: string
  publicoAlvo: string
  plataforma: string
  duracao: number
  objetivo: string
  estilo: string
  temImagem?: boolean
}

export async function gerarVideoSeller(
  entrada: EntradaVideoSeller
): Promise<VideoSellerOutput> {
  const userPrompt = `Crie roteiro e prompt de vídeo comercial para:

PRODUTO: ${entrada.nome}
DESCRIÇÃO: ${entrada.descricao || 'Não informada'}
PÚBLICO-ALVO: ${entrada.publicoAlvo}
PLATAFORMA: ${entrada.plataforma}
DURAÇÃO: ${entrada.duracao} segundos
OBJETIVO: ${entrada.objetivo}
ESTILO: ${entrada.estilo}

Retorne JSON com:
{
  "analiseProduto": {
    "tipo": "string",
    "publicoAlvo": "string",
    "diferenciais": ["string"],
    "melhorFormato": "string"
  },
  "objetivoVideo": "string",
  "ideaCentral": "string",
  "roteiro": [
    {
      "cena": 1,
      "inicio": "0s",
      "fim": "3s",
      "descricaoVisual": "string",
      "movimento": "string",
      "textoTela": "string",
      "som": "string",
      "objetivo": "string"
    }
  ],
  "textosTela": ["string"],
  "narracao": "string",
  "estiloVisual": "string",
  "sugestaoMusica": "string",
  "promptCompleto": "string detalhado em inglês para Runway/Kling/Pika/Veo",
  "promptCurto": "string em inglês versão compacta",
  "ctaFinal": ["string"],
  "variacoesTeste": [
    {
      "versao": "A",
      "descricao": "string",
      "diferencial": "string"
    }
  ],
  "hashtagsSugeridas": ["string"],
  "tituloSugerido": "string"
}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `Você é o Patrono Video Seller, especialista em criação de vídeos comerciais para e-commerce brasileiro.
Crie roteiros profissionais, persuasivos e otimizados para conversão.
Os prompts de vídeo devem ser em inglês, detalhados e compatíveis com Runway, Kling, Pika e Veo.
Retorne APENAS JSON válido, sem markdown, sem explicações.`,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned) as VideoSellerOutput
  } catch {
    throw new Error('Falha ao interpretar resposta do Video Seller. Tente novamente.')
  }
}

// ─── Análise de Compliance ────────────────────────────────────────────────────

export async function analisarCompliance(params: {
  roteiro: string
  legenda: string
  tipoVenda: string
  origemConteudo: string
}): Promise<AlertaCompliance[]> {
  const userPrompt = `Analise este conteúdo para riscos legais e de plataforma no contexto brasileiro:

ROTEIRO: ${params.roteiro}
LEGENDA: ${params.legenda}
TIPO DE VENDA: ${params.tipoVenda}
ORIGEM DO CONTEÚDO: ${params.origemConteudo}

Retorne JSON:
{
  "alertas": [
    {
      "tipo": "publicidade|copyright|ia|enganoso|plataforma",
      "mensagem": "string",
      "severidade": "verde|amarelo|vermelho",
      "acaoRecomendada": "string"
    }
  ]
}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `Você é especialista em compliance de marketing digital, LGPD, direitos autorais e regras de plataformas (TikTok, Instagram, YouTube) no Brasil.
Retorne APENAS JSON válido.`,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return parsed.alertas as AlertaCompliance[]
  } catch {
    return []
  }
}
