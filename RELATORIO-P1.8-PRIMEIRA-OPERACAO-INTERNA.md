# P1.8 — Primeira operação real interna

**O ciclo completo rodou com dados reais em produção: 5 jobs criados, 5
executados, 5 peças geradas, 0 falhas, custo R$ 0,00 — e zero publicação.**

`AutomationJob` e `Conteudo` mudaram, como se esperava. `Publicacao`,
`LinkDinamico`, `EventoLink`, `MLModel` e `MLTrainingRun` **não mudaram**.

Data: 24/09/2026 · Commit `5e441a4` · `https://patrono-seller-ia.vercel.app`

---

## 1. Origem da mídia — os 9 produtos `comprei_e_testei`

**Preciso corrigir o que eu mesmo sugeri na P1.7.5.** Lá eu levantei a
hipótese de que, se as fotos fossem suas, o valor correto seria `Próprio`.
Fui verificar, e **a evidência aponta para o contrário**.

### O que encontrei

Todos os nove têm exatamente uma ou mais imagens, e **todas hospedadas em
`down-br.img.susercontent.com`** — o CDN da Shopee.

| Produto | Origem atual | Mídia | Host | Evidência de que é da usuária | Classificação sugerida |
|---|---|---|---|---|---|
| 50 Embalagens para Caneca Cerâmica 325ml Kraft | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Boneca Fada Voadora com Sensor | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Colchão Inflável Automático MODOFO | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Colete Salva Vidas Infantil Prolife | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Fio de Juta Lurex Dourado | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Kit Jogo 04 Copos Cactus 240ml | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Robô Aspirador H40 110V/220V | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Sapatilha Aquática Infantil 17-32 | `comprei_e_testei` | 1 imagem | Shopee CDN | **não** | **manter** |
| Trem Locomotiva Maria Fumaça Deluxe | `comprei_e_testei` | **10 imagens** | Shopee CDN | **não** | **manter** |

**Não alterei nenhum.** `comprei_e_testei` descreve como o **produto** foi
obtido, não quem fez a **foto**. Ter comprado e testado um robô aspirador
não dá direito sobre a imagem que o vendedor publicou na Shopee. O portão
está certo em bloquear, e a regra fail-closed fez exatamente o que devia.

**Impacto de uma correção indevida:** marcar esses nove como `Próprio`
liberaria compor vídeo a partir de imagem de terceiro. Seria inventar
autorização — exatamente o que o projeto existe para não fazer.

### O que apareceu de quebra, e é mais sério

Olhei o catálogo inteiro, cruzando origem declarada com o host da imagem:

| `origemConteudo` | Host da imagem | Produtos | Direito de derivar |
|---|---|---|---|
| `comprei_e_testei` | Shopee CDN | 9 | não |
| `Shopee` | (sem imagem) | 8 | não |
| `De fornecedor` | **Supabase da usuária** | 3 | não |
| `De fornecedor` | (sem imagem) | 1 | não |
| `Licenciado` | Shopee CDN | 1 | não |
| `Shopee` | **Supabase da usuária** | 1 | não |
| `Shopee` | Shopee CDN | 1 | não |
| **`Gerado por IA`** | **Shopee CDN** | **1** | **SIM** |

**O único produto que hoje tem direito de derivar mídia — o "Kit Torcedor
Copa do Mundo 2026", classificado `Gerado por IA` — tem as 6 imagens
hospedadas no CDN da Shopee.**

Se essas imagens fossem mesmo geradas por IA, estariam no armazenamento
dela, não no da Shopee. A classificação e a evidência se contradizem, e
**o erro aqui é para o lado perigoso**: é o único produto autorizado a virar
vídeo.

**Recomendo revisar esse, e não os nove.** Não mexi — classificação de
direito é declaração sua.

Os quatro produtos com imagem no **Supabase da usuária** (3 `De fornecedor`
+ 1 `Shopee`) são os únicos com evidência de que ela subiu o arquivo. Isso
prova **custódia**, não autoria: pode ser foto do fornecedor baixada e
reenviada. Também não mexi.

## 2. Instagram — o que falta exatamente

O preflight para em `SCOPE_NAO_VERIFICAVEL`. Fui atrás da causa real.

### Estado da integração

| | |
|---|---|
| `status` | `conectado` |
| `accessToken` | presente |
| `tokenExpiry` | **08/11/2026** — válido |
| `accountId` / `accountName` | presentes |
| `extraData` | contém **`appId` e `appSecret`** |
| Token do fluxo "Instagram login" (`IGAA…`) | **não** — é token de Facebook login |

### A causa

`SCOPE_NAO_VERIFICAVEL` é devolvido quando `scopesComprovados === null`
(`lib/autorizacao-da-conta.ts:329`). Esse valor é lido do `extraData`, no
campo `scopesComprovados` — e **esse campo não existe** no registro. Só há
`appId` e `appSecret`.

Ou seja: **não falta credencial. Falta a prova ter sido buscada e gravada.**

### O passo exato

Tudo o que é preciso já existe no código:

- `lib/instagram.ts` chama o `debug_token` oficial da Meta e devolve os
  escopos;
- `app/api/integracoes/instagram/revalidar/route.ts` grava o resultado em
  `extraData.scopesComprovados`;
- `app/(dashboard)/integracoes/page.tsx:241` já tem o botão que dispara
  isso.

**O passo é:**

1. Entrar em `https://patrono-seller-ia.vercel.app` com sua conta;
2. Ir em **Integrações**;
3. No card do Instagram, clicar no botão de **revalidar permissões**.

Ele faz `POST /api/integracoes/instagram/revalidar`, que **exige sessão
autenticada** — por isso eu não consigo disparar, e é correto que não
consiga.

Se a Meta devolver `instagram_content_publish`, o preflight sai de
`SCOPE_NAO_VERIFICAVEL` sozinho. Se devolver a lista sem esse escopo, o
bloqueio vira `ESCOPO_INSUFICIENTE` — aí sim é caso de reconectar
concedendo a permissão.

**Uma observação sobre a mensagem.** O preflight diz *"Reconecte a conta
informando App ID e App Secret"*. Nesta conta os dois **já estão lá** — o
texto assume que faltam credenciais, quando na verdade falta rodar a
verificação. A orientação está desalinhada com este caso, e vale ajustar o
texto numa próxima rodada.

Nenhum segredo foi exibido: li apenas se os campos existem, não o conteúdo.

## 3. A execução operacional

### Travas conferidas antes

| | |
|---|---|
| `automationPaused` | `true` |
| `automationMode` | `MANUAL` |
| `ADAPTADORES_LIGADOS` | `{}` |
| `PUBLICACAO_REAL_*` | ausente em produção |

**Não precisei tocar no kill switch.** Fui verificar onde `automationPaused`
é lido: em `lib/autopilot.ts`, que é o fluxo de **publicação**. Nem o ciclo
de oportunidades nem o executor da fila o consultam — e isso é coerente, não
é buraco: o kill switch existe para impedir que algo vá ao ar, não para
impedir trabalho interno. Como esta rodada é só trabalho interno, ele ficou
`true` do começo ao fim.

### Cron de oportunidades, modo operação

```
GET /api/cron/oportunidades      (sem ?modo=ensaio)
HTTP 200 em 9,65 s
```

```
modo: "OPERACAO — fila sincronizada"
escreveu: true
workspaces: 1        oportunidadesAvaliadas: 20
itensDePlano: 5      jobsDesejados: 5
jobsCriados: 5       jobsMantidos: 0      jobsCancelados: 0
nasceriamWaiting: 0  lacunasDeFormato: 0  recusados: 0  erros: 0
custoTotal: 0
```

Os cinco jobs nasceram `PENDING`, `tentativas = 0`, todos do tipo
`GERAR_CONTEUDO`.

### Executor da fila

```
GET /api/cron/executar-fila
HTTP 200 em 4,17 s
```

| | |
|---|---|
| Capacidades do worker | `ffmpeg: false`, `chatterbox: false`, 2,01 GB livres |
| Executados | **5** |
| Sucessos | **5** |
| Aguardando | **0** |
| Falhas | **0** |
| Destravados | 0 |
| `canaisLigados` | **`[]`** |
| `custoTotal` | **0** |

Todos os cinco terminaram `SUCCEEDED`.

## 4. Resultado

### Produtos processados e peças geradas

| # | Produto | Canal | Formato | Peça | Status |
|---|---|---|---|---|---|
| 1 | Robô Aspirador H40 110V/220V Original Lacrado | instagram | `TEXTO_COM_LINK` | `cmufwq0l9…` | `roteiro_gerado` |
| 2 | Colchão Inflável Automático MODOFO | instagram | `TEXTO_COM_LINK` | `cmufwq161…` | `roteiro_gerado` |
| 3 | Trem Locomotiva Maria Fumaça Deluxe | instagram | `TEXTO_COM_LINK` | `cmufwq1ji…` | `roteiro_gerado` |
| 4 | Colete Salva Vidas Infantil Prolife | instagram | `TEXTO_COM_LINK` | `cmufwq1wz…` | `roteiro_gerado` |
| 5 | Boneca Fada Voadora com Sensor | instagram | `TEXTO_COM_LINK` | `cmufwq2af…` | `roteiro_gerado` |

**5 jobs criados · 5 conteúdos gerados · 0 WAITING · 0 falhas.**

Nenhum ficou `WAITING` porque `TEXTO_COM_LINK` não depende de FFmpeg nem de
GPU — e nenhuma das duas está disponível no worker.

### O que as peças trazem

Exemplo real, da peça 1:

```
Robô Aspirador H40 110V/220V Original Lacrado — R$ 299,90 (consultado em 24/09/2026).

Este conteúdo contém link de afiliado — posso ganhar uma comissão sobre a venda.

#tiktokmademebuyit #eletrodomésticos
```

Três coisas que valem registro: o **preço vem com a data em que foi
consultado** (não finge ser de agora), o **disclosure de afiliado está na
legenda** (não num campo separado que alguém esquece de copiar), e
`videoUrl` e `linkUrl` estão vazios — o link rastreado nasce na publicação,
que não aconteceu.

### Preflight das 5 peças

| | |
|---|---|
| Peças avaliadas | 5 |
| `pronto` | **0 de 5** |
| `executavelAgora` | **0 de 5** |
| Bloqueio | `SCOPE_NAO_VERIFICAVEL` nas cinco |
| `custoZero` | `true` nas cinco |
| `capabilityEfetiva` | `publicar=false`, `draft=false` nas cinco |
| `Publicacao` no banco | **0** |

**As cinco peças existem e nenhuma pode ir ao ar.** O que as segura é o
Instagram sem escopo comprovado — e, atrás disso, o registro de adapters
vazio.

## 5. Verificação antes/depois

| Tabela | Antes | Depois | Delta | Esperado | |
|---|---|---|---|---|---|
| `AutomationJob` | 0 | **5** | **+5** | pode mudar | ok |
| `Conteudo` | 17 | **22** | **+5** | pode mudar | ok |
| `Publicacao` | 0 | 0 | **+0** | não pode mudar | ok |
| `LinkDinamico` | 126 | 126 | **+0** | não pode mudar | ok |
| `EventoLink` | 0 | 0 | **+0** | não pode mudar | ok |
| `MLModel` | 0 | 0 | **+0** | não pode mudar | ok |
| `MLTrainingRun` | 0 | 0 | **+0** | não pode mudar | ok |

**As duas que podiam mudar mudaram exatamente na medida do trabalho feito;
as cinco que não podiam não mudaram.**

## 6. Custo e publicação

| | |
|---|---|
| `custoTotal` do ciclo | **0** |
| `custoTotal` do executor | **0** |
| `PROVEDOR_PAGO_AUTORIZADO` | `false`, cravado no código |
| Provider pago chamado | **nenhum** |
| `Publicacao` criada | **nenhuma** |
| Instagram real | **nenhuma chamada** |
| TikTok real | **nenhuma chamada** |
| `canaisLigados` do executor | `[]` |
| Treino / promoção de ML | **nenhum** |
| **Custo** | **R$ 0,00** |

## 7. Estado das travas — tudo preservado

| | |
|---|---|
| `automationPaused` | **`true`** — nunca alterado |
| `automationMode` | **`MANUAL`** — nunca alterado |
| `ADAPTADORES_LIGADOS` | `{}` |
| `RENOVADORES_LIGADOS` | `{}` |
| `PUBLICACAO_REAL_*` em produção | ausente |
| `main` | intocada — `6acdd7b`, sem merge, sem sync |
| Schedules | inertes — `vercel.json` é `{}` e o workflow não está na branch padrão |

Suíte: **1.768 testes, 0 falhas**. `tsc --noEmit`: exit 0.

---

## 8. Próximo passo mínimo para a primeira publicação real controlada

Na ordem, e a primeira é sua:

**1. Revalidar as permissões do Instagram.** Entrar no app → Integrações →
botão de revalidar no card do Instagram. É o único bloqueio das cinco peças.
Depois disso o preflight dirá se o escopo existe (`pronto: true`) ou se
falta conceder (`ESCOPO_INSUFICIENTE`).

**2. Revisar a classificação do "Kit Torcedor Copa do Mundo 2026".** É o
único produto com direito de derivar mídia, e as imagens dele estão no CDN
da Shopee. Se a classificação `Gerado por IA` não estiver certa, ela precisa
cair antes de qualquer geração de vídeo.

**3. Escolher UMA peça e publicar sob observação.** Só depois de (1). Exige
definir `PUBLICACAO_REAL_INSTAGRAM=true` em produção e ligar o adapter — e
recomendo fazer as duas coisas, publicar uma única peça, conferir o
resultado, e **desligar de novo** antes de pensar em automação.

É essa primeira publicação que fecha o ciclo: link rastreado → clique →
venda → amostra rotulada → ML saindo do shadow mode. Enquanto não houver um
clique real, o `SEM_HISTORICO_REAL` das cinco peças continua sendo a
verdade, e nenhuma projeção de receita tem base.

Paro aqui para sua revisão.
