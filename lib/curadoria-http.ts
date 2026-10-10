/**
 * P2.14.5.13 — o que as rotas de /api/oportunidades devolvem. Só campos do
 * candidato; nada de token, segredo ou dado de outro workspace.
 */
import { NextResponse } from 'next/server'
import type { CandidatoDeProduto } from '@prisma/client'
import { ErroDeCuradoria } from './curadoria'

export function candidatoParaTela(c: CandidatoDeProduto) {
  return {
    id: c.id,
    posicao: c.posicao,
    status: c.status,
    nome: c.nome,
    fonte: c.fonte,
    providerId: c.providerId,
    linkProduto: c.linkProduto,
    // Imagem só sai da API quando o direito de uso foi verificado.
    imagem: c.imagemAutorizada ? c.imagem : null,
    imagemInformadaSemDireito: !c.imagemAutorizada && c.imagem !== null,
    categoria: c.categoria,
    preco: c.preco,
    comissaoPercentual: c.comissaoPercentual,
    comissaoValor: c.comissaoValor,
    vendas: c.vendas,
    velocidadeDeVendas: c.velocidadeDeVendas,
    avaliacao: c.avaliacao,
    numeroDeAvaliacoes: c.numeroDeAvaliacoes,
    estoque: c.estoque,
    score: c.score,
    baseDeEvidencia: c.baseDeEvidencia,
    aderencia: c.aderencia,
    aderenciaDoPerfil: c.aderenciaDoPerfil,
    afinidade: c.afinidade,
    confianca: c.confianca,
    nivelDeRisco: c.nivelDeRisco,
    publicacaoImpedida: c.publicacaoImpedida,
    compradoPelaTitular: c.compradoPelaTitular,
    usadoPelaTitular: c.usadoPelaTitular,
    motivosPositivos: c.motivosPositivos,
    riscos: c.riscos,
    desconhecidos: c.desconhecidos,
    porqueDestaPosicao: c.porqueDestaPosicao,
    coletadoEm: c.coletadoEm.toISOString(),
    validoAte: c.validoAte.toISOString(),
  }
}

export type CandidatoNaTela = ReturnType<typeof candidatoParaTela>

export function respostaDeErro(e: unknown) {
  if (e instanceof ErroDeCuradoria) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error('Erro na curadoria:', e)
  return NextResponse.json({ error: 'Erro interno ao processar a curadoria.' }, { status: 500 })
}

export { ultimaColetaParaTela } from './curadoria-estado'
export type { UltimaColetaNaTela } from './curadoria-estado'
