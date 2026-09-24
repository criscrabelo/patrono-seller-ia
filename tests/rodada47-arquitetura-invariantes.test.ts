/**
 * Invariantes de arquitetura, verificadas no GRAFO DE IMPORTS.
 *
 * Uma varredura de texto num arquivo só prova o que aquele arquivo faz.
 * Estes testes caminham pelas importações a partir de cada cron e
 * perguntam o que é ALCANÇÁVEL — que é a pergunta que importa quando o
 * risco é "alguém, três módulos abaixo, chama o provider pago".
 *
 * Eles falham no dia em que um import novo abrir um caminho que hoje não
 * existe. É de propósito: é mais barato descobrir aqui do que na fatura.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'

const RAIZ = join(__dirname, '..')

/** Resolve um import relativo ou com alias `@/` para um arquivo real. */
function resolver(deArquivo: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(RAIZ, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(deArquivo), spec)
  else return null // pacote de node_modules: fora do nosso grafo
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand) && !cand.endsWith('/')) {
      try {
        if (readFileSync(cand, 'utf8') !== undefined) return cand
      } catch {
        /* diretório: segue para o próximo candidato */
      }
    }
  }
  return null
}

/** Todos os arquivos do projeto alcançáveis a partir de um ponto de entrada. */
function alcancaveis(entrada: string): Set<string> {
  const vistos = new Set<string>()
  const fila = [entrada]
  const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+'([^']+)'|import\s*\(\s*'([^']+)'\s*\)/g
  while (fila.length) {
    const arq = fila.pop()!
    if (vistos.has(arq)) continue
    vistos.add(arq)
    let src = ''
    try {
      src = readFileSync(arq, 'utf8')
    } catch {
      continue
    }
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2]
      if (!spec) continue
      const alvo = resolver(arq, spec)
      if (alvo && !vistos.has(alvo)) fila.push(alvo)
    }
  }
  return vistos
}

const CRONS = [
  'app/api/cron/oportunidades/route.ts',
  'app/api/cron/executar-fila/route.ts',
  'app/api/cron/ml-janela-observacao/route.ts',
  'app/api/cron/sincronizar-catalogo/route.ts',
]

describe('Nenhum cron alcança provider pago', () => {
  for (const cron of CRONS) {
    test(`${cron} não alcança lib/falai.ts`, () => {
      const grafo = alcancaveis(join(RAIZ, cron))
      const pago = [...grafo].filter((f) => /[\\/]lib[\\/]falai\.ts$/.test(f))
      assert.deepEqual(
        pago,
        [],
        `${cron} alcança o provider pago por: ${[...grafo].filter((f) => f.includes('falai')).join(', ')}`
      )
    })
  }

  test('o grafo do ciclo de oportunidades é realmente percorrido', () => {
    // Guarda do próprio teste: se o resolvedor parasse de achar arquivos,
    // os testes acima passariam por vazio e não provariam nada.
    const grafo = alcancaveis(join(RAIZ, 'app/api/cron/oportunidades/route.ts'))
    assert.ok(grafo.size > 10, `grafo pequeno demais (${grafo.size}) — o resolvedor quebrou`)
    assert.ok(
      [...grafo].some((f) => f.endsWith('ciclo-de-oportunidades.ts')),
      'o ciclo deveria estar no grafo'
    )
    assert.ok([...grafo].some((f) => f.endsWith('plano-de-acao.ts')))
  })
})

describe('O ciclo de oportunidades não alcança publicação', () => {
  test('nenhum módulo de distribuição entra no grafo do cron diário', () => {
    const grafo = [...alcancaveis(join(RAIZ, 'app/api/cron/oportunidades/route.ts'))]
    for (const proibido of [
      'distribuicao-orquestrador.ts',
      'adaptadores-reais.ts',
      'publicacao-fluxo.ts',
      'instagram.ts',
      'tiktok-channel.ts',
    ]) {
      assert.ok(
        !grafo.some((f) => f.endsWith(proibido)),
        `o cron de oportunidades alcança ${proibido}`
      )
    }
  })

  test('o executor ALCANÇA distribuição — e isso é por desenho', () => {
    // Não é falha: o executor registra a ação de distribuir. O que impede a
    // publicação é ADAPTADORES_LIGADOS vazio, não a ausência do import.
    // Este teste existe para que a diferença fique explícita.
    const grafo = [...alcancaveis(join(RAIZ, 'app/api/cron/executar-fila/route.ts'))]
    assert.ok(grafo.some((f) => f.endsWith('distribuicao-orquestrador.ts')))
    assert.ok(grafo.some((f) => f.endsWith('adaptadores-reais.ts')))
  })
})

describe('Autoridade única de capacidades da fábrica', () => {
  test('só um arquivo declara a lista de formatos produzidos', () => {
    const declaram: string[] = []
    for (const rel of [
      'lib/capacidades-da-fabrica.ts',
      'lib/fabrica-de-conteudo.ts',
      'lib/plano-de-acao.ts',
      'lib/ciclo-de-oportunidades.ts',
    ]) {
      const s = readFileSync(join(RAIZ, rel), 'utf8')
      // A assinatura de uma DECLARAÇÃO de lista: os dois formatos, como
      // literais, dentro de um array.
      if (/\[\s*\n?\s*'VIDEO_9X16_FFMPEG_NARRADO',\s*\n?\s*'TEXTO_COM_LINK',?\s*\n?\s*\]/.test(s)) {
        declaram.push(rel)
      }
    }
    assert.deepEqual(declaram, ['lib/capacidades-da-fabrica.ts'])
  })
})

describe('Os portões de publicação continuam fechados', () => {
  test('nenhum canal está em ADAPTADORES_DISPONIVEIS além do Instagram', () => {
    const s = readFileSync(join(RAIZ, 'lib/adaptadores-reais.ts'), 'utf8')
    const bloco = s.slice(
      s.indexOf('export const ADAPTADORES_DISPONIVEIS'),
      s.indexOf('export const CANAIS_SEM_ADAPTER_DISPONIVEL')
    )
    assert.match(bloco, /instagram: adaptadorInstagram/)
    for (const canal of ['tiktok:', 'facebook:', 'youtube:', 'pinterest:']) {
      assert.ok(!bloco.includes(canal), `${canal} não pode estar disponível`)
    }
  })

  test('o registro de adapters ligados nasce vazio no código', () => {
    const s = readFileSync(join(RAIZ, 'lib/distribuicao-orquestrador.ts'), 'utf8')
    assert.match(s, /export const ADAPTADORES_LIGADOS: Record<string, AdaptadorDeCanal> = \{\}/)
  })

  test('o registro de renovadores ligados nasce vazio no código', () => {
    const s = readFileSync(join(RAIZ, 'lib/renovacao-de-acesso.ts'), 'utf8')
    assert.match(s, /export const RENOVADORES_LIGADOS: Record<string, RenovadorDeAcesso> = \{\}/)
  })
})

describe('Machine Learning continua em shadow mode', () => {
  /** Remove comentarios: a invariante e sobre CHAMADA, e comentario nao chama. */
  function semComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*/gm, '$1 ')
  }

  test('nenhum cron CHAMA treino ou promocao de modelo', () => {
    const DEFINEM = ['ml-model.ts', 'ml-model-registry.ts', 'ml-training-pipeline.ts']
    let examinados = 0
    for (const entrada of CRONS) {
      for (const f of alcancaveis(join(RAIZ, entrada))) {
        // Separador de caminho varia por sistema: no Windows é barra
        // invertida, e um filtro só com `/` deixaria o teste vazio.
        if (!f.includes(`${sep}lib${sep}`)) continue
        examinados += 1
        if (DEFINEM.some((d) => f.endsWith(d))) continue // e onde a funcao mora
        const codigo = semComentarios(readFileSync(f, 'utf8'))
        for (const chamada of [/treinarRegressaoLogistica\s*\(/, /promoverModelo\s*\(/, /treinarModeloConversao\s*\(/]) {
          assert.ok(!chamada.test(codigo), `${entrada} alcanca ${chamada} sendo CHAMADO em ${f}`)
        }
      }
    }
    assert.ok(examinados > 20, `poucos arquivos examinados (${examinados}) — o filtro quebrou`)
  })

  test('o cron diario nem alcanca o pipeline de treino', () => {
    // Antes desta rodada alcancava: lib/ml-engine.ts importava so a
    // constante CONVERSION_MODEL_FAMILY do pipeline, e um import de
    // constante e um import de modulo. Nada era treinado por isso, mas a
    // fronteira ficava indefensavel. A constante mudou para
    // lib/ml-constantes.ts; quem le nao carrega mais quem treina.
    const grafo = [...alcancaveis(join(RAIZ, 'app/api/cron/oportunidades/route.ts'))]
    assert.ok(!grafo.some((f) => f.endsWith('ml-training-pipeline.ts')), 'o treino voltou ao grafo do cron')
  })

  test('a constante mora num modulo puro, sem import', () => {
    const s = readFileSync(join(RAIZ, 'lib/ml-constantes.ts'), 'utf8')
    assert.deepEqual(s.match(/^\s*import/gm) ?? [], [])
    assert.match(s, /CONVERSION_MODEL_FAMILY = 'conversion_probability'/)
  })
})

describe('Observabilidade dos crons', () => {
  test('o cron do executor reporta FALHAS, nao so sucessos', () => {
    // O laco sempre contou `falhas`; a rota nao as devolvia. Uma execucao
    // com jobs falhando ficava indistinguivel de uma limpa para quem le a
    // resposta — e e a resposta que alguem olha quando algo parece parado.
    const s = readFileSync(join(RAIZ, 'app/api/cron/executar-fila/route.ts'), 'utf8')
    assert.match(s, /totalFalhas \+= r\.falhas/)
    assert.match(s, /^\s*totalFalhas,$/m)
  })

  test('o cron de oportunidades reporta erro por workspace', () => {
    const s = readFileSync(join(RAIZ, 'lib/ciclo-de-oportunidades.ts'), 'utf8')
    assert.match(s, /erro: string \| null/)
    assert.match(s, /erros: porWorkspace\.filter/)
  })

  test('os dois crons declaram custo na resposta', () => {
    const ciclo = readFileSync(join(RAIZ, 'lib/ciclo-de-oportunidades.ts'), 'utf8')
    assert.match(ciclo, /custoTotal: 0/)
    const exec = readFileSync(join(RAIZ, 'app/api/cron/executar-fila/route.ts'), 'utf8')
    assert.match(exec, /custoTotal: 0/)
  })
})
