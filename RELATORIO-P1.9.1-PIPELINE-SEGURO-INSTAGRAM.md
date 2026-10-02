# P1.9.1 — Pipeline de primeira publicação segura no Instagram

**O Patrono agora só diz `pronto` quando o adapter real do Instagram
publicaria a peça e a peça é juridicamente segura. As cinco peças da P1.8
passaram de `pronto: true` para `pronto: false`, cada uma com os motivos
nomeados. O pipeline para montar uma peça publicável a partir de um vídeo seu
está pronto e testado.**

Não existe hoje, em produção, nenhuma mídia própria com evidência. Por isso
parei antes do dry run real e digo abaixo exatamente o que preciso (§7).

Data: 01/10/2026 · Branch `claude/pronto-para-trabalhar-jiij19` · base `633cc72` · **não commitado**

Zero publicação. `PUBLICACAO_REAL_INSTAGRAM` nunca foi ligado. Nenhuma chamada
ao Instagram. Custo R$ 0,00.

---

## 1. Bugs corrigidos

| # | Bug | Onde estava | Correção |
|---|---|---|---|
| 1 | Preflight aprovava `TEXTO_COM_LINK` no Instagram, e o adapter o recusaria | `distribuicao-orquestrador` perguntava à **plataforma** (aceita imagem), não ao **adapter** (só Reel com vídeo) | Fonte única: `lib/capacidade-real-do-adapter.ts`, lida pelo preflight e pelo adapter |
| 2 | "consultado em [data de hoje]" | `conteudo-gratuito.ts:47`: `atualizadoEm ?? new Date()`. E a fábrica nem passava a data | `lib/preco-verificado.ts`. Data só de verificação real |
| 3 | `updatedAt` usado como data de consulta do preço | `digital-twin-worker-core.ts:361`, `api/conteudos/gerar` | Mesma regra do item 2 |
| 4 | `#tiktokmademebuyit` no Instagram | uma legenda única para todos os canais | `lib/copy-por-canal.ts`: legenda e hashtags por canal |
| 5 | Sem CTA na legenda do Instagram | o CTA ficava fora da legenda | "Link na bio." em toda legenda do Instagram |
| 6 | "Homologado", "Original Lacrado" repetidos do título do vendedor | nome entrava inteiro | Claims removidos do título e registrados como alerta |
| 7 | URL colada numa legenda onde não é clicável | orquestrador sempre anexava a URL | Estratégia de link por canal; Instagram = bio |
| 8 | Imagem de terceiro aceita só pela origem declarada (Kit Torcedor) | `media-rights-produto` só lia a declaração | Declaração "Próprio"/"Gerado por IA" com imagem em CDN de marketplace vira `UNKNOWN` |
| 9 | `distribuirConteudo` não repassava o `env` ao contexto | achado durante os testes desta rodada | Corrigido. A custódia era verificada contra o ambiente errado |
| 10 | Texto de `SCOPE_NAO_VERIFICAVEL` mandava reconectar quando bastava revalidar | apontado na P1.8 | Mensagem nova |

## 2. Comportamento novo do preflight

Novos motivos de bloqueio:

- **`FORMATO_INCOMPATIVEL_COM_ADAPTER`**: a plataforma aceita o formato, mas o adapter real não o envia.
- **`MIDIA_OBRIGATORIA_AUSENTE`**: o adapter exige vídeo e a peça não tem.

Texto sem vídeo no Instagram recebe os dois. Se só faltar a mídia, o estado é
`AGUARDANDO_MIDIA_AUTORIZADA`.

**Fonte única.** `CAPACIDADE_REAL_DO_ADAPTER.instagram` declara:

- formatos: `VIDEO_9X16_FFMPEG_NARRADO` e `VIDEO_PROPRIO`;
- mídia obrigatória: vídeo;
- link: bio.

O preflight chama `avaliarPecaParaOAdapter()`. O adapter real chama **a mesma
função** antes de abrir rede, e agora recebe o `formato` no pedido. Pedido sem
formato é recusado (fail-closed).

Testes de invariante garantem três coisas:

- todo adapter disponível tem capacidade declarada, e vice-versa;
- cada formato declarado existe no catálogo e é aceito pela plataforma;
- a estratégia de link é uma só.

**Pendências novas da legenda**, todas como `COMPLIANCE_PENDENTE`:

- `HASHTAG_DE_OUTRO_CANAL`
- `CLAIM_NAO_COMPROVADO`
- `CTA_AUSENTE`
- `LINK_NAO_CLICAVEL`
- `PRECO_NAO_VERIFICADO` / `PRECO_DESATUALIZADO`

**Novos campos no relatório do preflight:** `formato`, `aceitoPeloAdapter`,
`motivoDaMidia`, `estrategiaDeLink` e `pendencias`. O dry run passa a mostrar
`ondeVaiOLink` e `urlNaLegenda`.

**As 5 peças reais da P1.8, reavaliadas em produção (somente leitura):**

| Peça | pronto | bloqueio | pendências |
|---|---|---|---|
| Robô Aspirador H40 | false | `FORMATO_INCOMPATIVEL_COM_ADAPTER` | hashtag, claim, CTA, preço |
| Colchão Inflável MODOFO | false | idem | hashtag, CTA, preço |
| Trem Maria Fumaça | false | idem | hashtag, CTA, preço |
| Colete Salva Vidas | false | idem | hashtag, claim, CTA, preço |
| Boneca Fada | false | idem | hashtag, CTA, preço |

Os contadores de produção não mudaram: `Publicacao` 0→0, `LinkDinamico`
126→126, `Conteudo` 22→22.

## 3. Regra de data e preço (`lib/preco-verificado.ts`)

1. **A data vem só de verificação real.** Hoje o único evento que verifica o
   preço é a sincronização com a origem (`Produto.sincronizadoEm`).
   `updatedAt` não conta, porque qualquer edição do cadastro o move.
2. **Sem data, a legenda não afirma preço nem data.** Ela diz "confira o preço
   atual". O alerta gravado é `PRECO_NAO_VERIFICADO`.
3. **Data com mais de 3 dias** (`VALIDADE_DO_PRECO_DIAS`): o preço sai da
   legenda e o alerta é `PRECO_DESATUALIZADO`. Data no futuro conta como
   desatualizada.
4. **Legenda já escrita.** Se ela afirma `R$` sem verificação que a sustente,
   ou com data diferente da real, o preflight bloqueia. É isso que segura as
   peças antigas.

Nenhum dos 22 produtos ativos tem `sincronizadoEm`. Todos foram cadastrados à
mão. Por isso, hoje, **nenhuma legenda vai afirmar preço**. É o correto: não
há verificação para mostrar. Os 3 dias são escolha minha e o valor é ajustável.

## 4. Regra de mídia e direitos (`lib/evidencia-de-midia.ts`)

Para publicação real (canal com adapter real), o que decide é o direito **do
arquivo publicado**, não a origem do produto. O arquivo precisa de um registro
`direito_da_midia` na peça que cumpra todas estas condições:

1. **Origem do vocabulário fechado:**
   - `PROPRIO`;
   - `LICENCIADO`, com referência de termo obrigatória;
   - `GERADO_PELO_PATRONO`, com id da geração obrigatório.
2. **O registro aponta para este arquivo exato.**
3. **Diz quem declarou e quando.**
4. **O arquivo está no storage do próprio projeto.** É custódia: condição
   necessária, nunca suficiente.
5. **O arquivo não está em host de terceiro:** Shopee, Mercado Livre, Amazon,
   AliExpress, TikTok ou Magalu.

`comprei_e_testei`, `Shopee` e `De fornecedor` não entram nessa conta.

Para o direito de derivar do produto, "Próprio" ou "Gerado por IA" com imagem
em CDN de marketplace agora cai para `UNKNOWN`. **O Kit Torcedor perde o
direito de derivar**, como recomendado na P1.8.

## 5. Estratégia de link

| Canal | Estratégia | URL na legenda? |
|---|---|---|
| Instagram | **BIO** | **não** |
| TikTok | BIO | não |
| Facebook | LEGENDA | sim (sem adapter hoje) |
| Demais | não verificado | **não**: na dúvida, nunca se oferece link que não abre |

No Instagram, a legenda e os comentários não geram link clicável, e a API de
publicação de conteúdo não cria link sticker. A bio é o caminho suportado.

O `LinkDinamico` rastreado continua nascendo na publicação, idempotente pela
chave da tentativa. O dry run mostra a URL exata antes de qualquer gravação.

**Isto é um passo humano.** Até onde sei, a API oficial não edita a bio, então
quem publica cola o link rastreado na bio antes do post. Com uma publicação
por vez, um link na bio basta. Para vários posts ao mesmo tempo seria preciso
uma página de "links da bio", que **não** foi construída.

## 6. Peça recomendada para o primeiro teste

**Colchão Inflável Automático MODOFO Casal/Queen/King.**

- O título não tem nenhum claim a remover. O Robô Aspirador perde "Original
  Lacrado" e o Colete perde "Homologado".
- É produto adulto, sem as camadas de cuidado que existem em brinquedo
  infantil e em equipamento de segurança infantil (Boneca, Trem, Colete,
  Sapatilha).
- É `comprei_e_testei`: você tem o produto em mãos e pode filmá-lo.
- A demonstração visual é óbvia: ele infla sozinho em segundos.
- Está ativo e tem link Shopee cadastrado.

Prévia do que a peça teria (simulada no teste `rodada48`, sem gravar):

```
Colchão Inflável Automático MODOFO Casal/Queen/King — confira o preço atual.

Link na bio.

Este conteúdo contém link de afiliado — posso ganhar uma comissão sobre a venda.

#casaedecoração
```

| | |
|---|---|
| Formato | `VIDEO_PROPRIO` (Reel) |
| CTA | "Link na bio." |
| Disclosure | de afiliado, na legenda |
| Link rastreado | na bio do perfil |
| Preço | não afirmado (sem verificação real) |

## 7. Mídia que eu preciso que você forneça

Busca em produção (`scripts/buscar-midia-propria.ts`, somente leitura):

- **0 produtos com mídia própria declarada.** Os 3 com arquivos no seu storage
  estão declarados como `De fornecedor` ou `Shopee`, e custódia não prova
  autoria.
- **0 peças com vídeo publicável.** As 2 peças com vídeo no seu storage
  (Trem, Guarda-chuva) não têm registro de direito, e eu não sei de onde vêm.

**O que gravar:**

- **Um vídeo vertical 9:16, de 10 a 30 segundos, MP4 (H.264)**, filmado por
  você, mostrando o colchão inflando sozinho. Ambiente da sua casa, suas mãos.
- **Sem música de terceiros.** Use áudio ambiente ou nenhum.
- **Sem rosto de outras pessoas e sem crianças.**
- **Sem print ou tela da Shopee.**
- **Sem dizer "original", "o melhor" ou "garantido".**

**Como entra no Patrono:**

1. Suba o arquivo pelo upload do app, para que ele fique no storage do projeto.
2. Depois rode a prévia, que não grava nada:
   ```
   npx tsx scripts/preparar-peca-midia-propria.ts --workspace <id> --produto <id> \
     --video <url-do-storage> --declarado-por <seu-userId> \
     --descricao "vídeo que gravei do colchão inflando"
   ```
3. Com `--gravar`, ele grava **um** `Conteudo` (sem `Publicacao`) e roda o
   dry run, que mostra o link rastreado que iria na bio.

## 8. Testes

| | |
|---|---|
| Suíte (`tsx --test tests/*.test.ts`) | **1.814 testes, 1.814 passando, 0 falhas** |
| Antes desta rodada | 1.768 |
| Novos | **+46** (`tests/rodada48-pipeline-seguro-instagram.test.ts`) |
| `npx tsc --noEmit` | **exit 0** |
| Banco dos testes | banco de teste autorizado `xntkypjmmdovrfbblbqb` (ref conferida antes de cada execução) |

A suíte nova cobre cada item pedido:

- `TEXTO_COM_LINK` bloqueado no Instagram;
- mídia sem direito bloqueia, em 7 variações: Shopee, sem registro, outro
  arquivo, `comprei_e_testei`, licença sem termo, geração sem id, fora do
  storage;
- mídia própria segue;
- data ausente não é inventada;
- preço antigo gera alerta;
- CTA correto;
- hashtag do TikTok não entra no Instagram;
- claim removido e detectado;
- URL fora da legenda do Instagram;
- invariantes adapter × preflight;
- zero rede: `fetch` substituído por um espião, com 0 chamadas.

**Testes antigos atualizados, e por quê.** As rodadas 43, 44 e 47 afirmavam
`pronto: true` para `TEXTO_COM_LINK` no Instagram, ou seja, o próprio bug.
Passaram a afirmar `pronto: false` com `FORMATO_INCOMPATIVEL_COM_ADAPTER`. As
fixturas de "peça pronta" agora são peças realmente publicáveis
(`tests/_fixtura-midia-propria.ts`). Na rodada 41, a legenda do Instagram não
leva mais a URL. Na rodada 14b, o preço só aparece com verificação.

Os testes `.mjs` (`npm test`, primeira metade) exigem o app rodando em
`localhost:3100` e não foram executados, como nas rodadas anteriores.

## 9. Confirmação de zero publicação

| | |
|---|---|
| `PUBLICACAO_REAL_INSTAGRAM` | nunca ligado, ausente em produção |
| `ADAPTADORES_LIGADOS` / `adaptadoresHabilitados()` | `{}` |
| Chamada ao Instagram | **nenhuma**. Na suíte nova, `fetch` estava bloqueado: 0 chamadas |
| `Publicacao` em produção | 0 → 0 |
| `LinkDinamico` em produção | 126 → 126 |
| `Conteudo` em produção | 22 → 22 (nada gravado) |
| Escrita em produção | **nenhuma**. Só leituras: preflight e busca de mídia |
| Provider pago / ML | não usados / não treinado |
| TikTok | intocado |
| `main` | sem merge, sem sync |
| Custo | **R$ 0,00** |

## Lacunas que ficam, nomeadas

1. **O ciclo automático continua gerando `TEXTO_COM_LINK` para o Instagram.**
   O planejador ainda não consulta a capacidade real do adapter. Agora essas
   peças são corretamente bloqueadas e não há publicação fantasma, mas elas
   são trabalho que não vai ao ar. Recomendo como próxima correção.
2. **O vídeo FFmpeg (`VIDEO_9X16_FFMPEG_NARRADO`) não grava registro de
   direito.** Por isso fica bloqueado para o Instagram real até o render
   gravar `GERADO_PELO_PATRONO` com o id do job. Fail-closed, de propósito.
3. **Não existe modelo de termo de licença.** `LICENCIADO` só vale com
   referência textual do termo no registro da peça.
4. **O link na bio é manual**, e o preflight não confirma que ele foi
   colocado. Conferir a bio pela Graph API exigiria uma chamada, que não foi
   feita nesta rodada.

Paro aqui para revisão.
