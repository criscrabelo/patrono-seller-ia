# P1.9 — Primeira publicação real controlada no Instagram

**Resultado: NÃO PUBLICADO. Parei na etapa 2 (escolha da peça), antes de
tocar no flag. Nenhuma das 5 peças da P1.8 é segura — e, mais que isso,
nenhuma é publicável pelo adapter que existe.**

`PUBLICACAO_REAL_INSTAGRAM` **não foi ligado**. Nenhuma chamada ao
Instagram. Nenhuma escrita no banco. Custo R$ 0,00.

Data: 01/10/2026 · Branch `claude/pronto-para-trabalhar-jiij19` · Commit `633cc72`

---

## 1. Pré-check (somente leitura)

| Item | Resultado | |
|---|---|---|
| Ambiente | banco `db.aftqchhuknsqijsengoo.supabase.co` (produção) | ok |
| Branch / commit | `claude/pronto-para-trabalhar-jiij19` @ `633cc72`, árvore limpa | ok |
| Conta Instagram | `@boracomprarachados`, `status=conectado`, token até 30/11/2026 | ok |
| `scopesComprovados` | gravado; inclui `instagram_content_publish` | ok |
| Adapter Instagram | existe (`lib/adaptadores-reais.ts`) — **só publica Reel (vídeo)** | ver §2 |
| TikTok | fora de `ADAPTADORES_DISPONIVEIS` | ok |
| Provider pago | `PROVEDOR_PAGO_AUTORIZADO=false` no código | ok |
| ML | 0 `MLModel`, shadow mode | ok |
| `automationPaused` | `true` | ok |
| `automationMode` | `MANUAL` | ok |
| Schedules | `vercel.json` = `{}` | ok |
| `Publicacao` / `LinkDinamico` / `EventoLink` | 0 / 126 / 0 | ok |

O pré-check em si passou. O preflight das 5 peças agora dá `pronto: true`,
com o único bloqueio `ADAPTER_DESLIGADO`. **Mas esse `pronto` está errado**
(ver §2.1).

## 2. Por que nenhuma das 5 peças é segura

### 2.1 Bloqueio técnico — o adapter recusaria todas

- As 5 peças são `TEXTO_COM_LINK`, com `videoUrl = null`.
- O orquestrador monta `assetUrl = conteudo.videoUrl ?? null`
  (`lib/distribuicao-orquestrador.ts:287`).
- O adapter recusa sem mídia, como falha fatal
  (`lib/adaptadores-reais.ts:87`): *"o Instagram não aceita Reel sem mídia"*.
- E isso está certo: **a Graph API do Instagram não publica post só de
  texto**. Ela exige imagem, carrossel ou vídeo.

Ou seja, ligar o flag levaria a uma tentativa que falha de forma
previsível. No melhor caso não grava nada. No pior, deixa um registro de
falha em produção que não serve para nada.

**Achado: o preflight tem uma lacuna.** Ele trata `TEXTO_COM_LINK` como
formato que "não usa mídia" e por isso aprova `midiaAutorizada`
(`lib/distribuicao-orquestrador.ts:246-255`). Mas não verifica se o
**canal** aceita esse formato. No Instagram não aceita. O resultado é um
`pronto: true` que não corresponde a nada publicável.

### 2.2 Bloqueio de direito — não há mídia que possa ser usada

A saída óbvia seria "publica com a foto do produto". Ela não existe:

| Produto | Imagens | Host | Evidência de direito |
|---|---|---|---|
| Robô Aspirador H40 | 1 | Shopee CDN | não |
| Colchão Inflável MODOFO | 1 | Shopee CDN | não |
| Trem Maria Fumaça Deluxe | 10 | Shopee CDN | não |
| Colete Salva Vidas Prolife | 1 | Shopee CDN | não |
| Boneca Fada Voadora | 1 | Shopee CDN | não |

Todas as imagens são fotos de vendedor na Shopee (`origemConteudo =
comprei_e_testei` diz como o produto foi obtido, não quem fez a foto — ver
P1.8 §1). Publicar uma delas no perfil seria usar imagem de terceiro sem
autorização. Não há nenhuma mídia com direito comprovável nas 5.

### 2.3 Bloqueio de texto — a data do preço é enganosa

Todas as legendas dizem *"R$ X (consultado em 24/09/2026)"*. Mas o registro
do produto foi atualizado pela última vez **em maio de 2026** (09/05 e
20/05). Ninguém consultou o preço em 24/09: essa é a data em que a peça foi
**gerada**.

Causa: `lib/conteudo-gratuito.ts:47` usa
`(produto.atualizadoEm ?? new Date())`. Quando o campo não chega, cai em
`new Date()` e escreve a data de hoje como se fosse a data da consulta.
Hoje (01/10) o preço tem mais de 4 meses sem verificação.

Isso viola dois critérios do seu pedido de uma vez: *texto sem afirmação
enganosa* e *preço ainda válido*.

### 2.4 Outros pontos que também pesariam

- **Sem CTA e sem link na legenda.** `linkUrl = null`. O link rastreado
  nasceria só na publicação. E no Instagram, link na legenda não é
  clicável, então medir clique exigiria link na bio ou sticker. O ciclo
  "clique → venda" não fecharia nem se o post saísse.
- **`#tiktokmademebuyit` num post de Instagram.** Sugere uma origem que o
  post não tem. É fraco, mas é ruído de credibilidade.
- **Colete salva-vidas infantil "Homologado".** É produto de segurança
  infantil, e a alegação de homologação vem do título do vendedor, sem
  verificação. Eu nunca o escolheria para o primeiro teste.
- **Alertas amarelos** em todas as peças: benefícios e pontos negativos não
  foram revisados.

### 2.5 Kit Torcedor Copa 2026

Excluído, como você pediu. A classificação `Gerado por IA` continua em
contradição com as 6 imagens no CDN da Shopee.

## 3–10. Itens do relatório que não se aplicam

| # | Item | Estado |
|---|---|---|
| 3 | Prévia / dry run final | não feito: nenhuma peça passou na seleção |
| 4 | Horário da publicação | — |
| 5 | Resultado da API | nenhuma chamada |
| 6 | id / URL externa | — |
| 7 | Registros internos criados | **nenhum** (`Publicacao` 0, `LinkDinamico` 126, `EventoLink` 0, iguais ao início) |
| 8 | Duplicidade | zero, porque não houve publicação |
| 9 | Custo | **R$ 0,00** |
| 10 | Flag | **nunca ligado**. `PUBLICACAO_REAL_INSTAGRAM` continua ausente em produção, `adaptadoresHabilitados()` = `{}` |

## 11. Comportamentos inesperados

1. **Preflight `pronto: true` falso** para `TEXTO_COM_LINK` no Instagram (§2.1).
2. **Data de consulta de preço fabricada** pela geração (§2.3). É o mais
   grave dos dois, porque chegaria ao público.
3. A mensagem do preflight agora orienta *"Ligue com
   PUBLICACAO_REAL_INSTAGRAM=true"* como se isso bastasse. Foi essa
   mensagem que levou à premissa desta rodada de que o flag era o único
   bloqueio.

Nada foi alterado no código ou no banco nesta rodada. Toda a análise foi
somente leitura.

## 12. Próximo passo mínimo para uma primeira publicação de verdade

Em ordem:

1. **Uma mídia com direito comprovável.** O caminho mais seguro: uma foto
   ou vídeo **seu** de um produto que você tem em mãos, enviado ao seu
   Supabase e classificado `Próprio`. Sem isso, nenhum post do Instagram é
   seguro.
2. **Corrigir a data do preço** (`lib/conteudo-gratuito.ts:47`): usar a
   data real da última verificação, nunca `new Date()`. Se essa data
   estiver velha, escrever "confira o preço atual". Antes de publicar,
   reconsultar o preço do produto escolhido.
3. **Fechar a lacuna do preflight.** O canal Instagram tem de exigir mídia,
   e `TEXTO_COM_LINK` sem mídia deve dar `pronto: false`.
4. **Escolher o formato que o adapter suporta**: um Reel com o seu vídeo.
   Ou então escrever o caminho de imagem (`image_url`) no adapter, se a
   primeira peça for uma foto.
5. **Definir onde vai o link rastreado** (bio ou sticker), para que o
   clique seja mensurável. Depois: clique → `EventoLink` → venda → comissão.

Com (1)–(3) resolvidos, a sequência desta P1.9 (prévia, dry run, flag só
na janela, uma publicação, desligar) vale como está.

Paro aqui para sua revisão.
