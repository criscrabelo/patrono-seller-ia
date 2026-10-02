# P1.9.2 — Fechamento do pipeline de conteúdo publicável

**O Patrono não gera mais, para o Instagram, peças que o adapter real não
publica. Quando falta o vídeo, ele espera por ele: uma dependência humana
explícita, sem tentativa gasta. O fluxo do vídeo próprio está pronto de ponta
a ponta e para antes da publicação.**

**Achado grave desta rodada: havia duas rotas publicando no Instagram por
fora de tudo** — sem preflight, sem a flag, sem regra de direitos. Elas foram
fechadas atrás da mesma porta (§6).

Data: 01/10/2026 · Branch `claude/pronto-para-trabalhar-jiij19` · Zero
publicação · Custo R$ 0,00 · Sem migration.

---

## 1. Como o planner mudou

**Fonte única.** O planner agora consulta
`avaliarFormatoParaOCanal()` (`lib/capacidades-da-fabrica.ts`). Essa função
cruza duas declarações que já existiam, sem duplicar nenhuma:

- o que o adapter real publica — `lib/capacidade-real-do-adapter.ts`, a mesma
  lista que o preflight e o próprio adapter leem;
- o que a fábrica entrega — `MIDIA_ENTREGUE_PELA_FABRICA`.

**Quem consulta a autoridade agora:**

| Ponto | Pergunta que faz |
|---|---|
| Planner | escolhe só formato publicável pelo adapter do canal |
| Fábrica (`jobsDeGeracaoDoPlano`) | segunda trava: formato inútil não vira job |
| Fábrica (`gerarConteudoDoJob`) | job antigo de formato inútil termina **obsoleto (fatal)** |
| Executor (`acaoDeGerarConteudo`) | mesma checagem, antes de esperar por capacidade |
| Preflight e adapter | `avaliarPecaParaOAdapter()`, como já era desde a P1.9.1 |

**Para o Instagram, o resultado é este:**

| Formato | Por que sai |
|---|---|
| `TEXTO_COM_LINK` | `FORMATO_NAO_PUBLICAVEL_PELO_ADAPTER` |
| `VIDEO_9X16_FFMPEG_NARRADO` | `FABRICA_NAO_ENTREGA_MIDIA` — a fábrica só gera a copy; nenhum caminho grava o vídeo na peça |
| Carrossel, imagem, IA, Digital Twin | não publicáveis pelo adapter |
| **`VIDEO_PROPRIO`** | **escolhido** → `AGUARDANDO_MIDIA_AUTORIZADA` |

**Uma correção honesta no meio do caminho.** `VIDEO_9X16_FFMPEG_NARRADO`
estava declarado como "produzido", mas `gerarConteudoDoJob` termina com
`assetUrl: null`. O único render FFmpeg real (`PRODUCT_PREVIEW`, no worker
do Digital Twin) grava uma **prévia privada**, que não é `Conteudo.videoUrl`.
Isso agora está declarado: a fábrica não entrega vídeo para o Instagram.

**Canais sem adapter real** (TikTok, Facebook e os demais) não mudam de
comportamento. Nenhum deles publica de verdade.

**Ensaio em produção, só leitura, com o planner novo:**
- os 5 itens do plano saem como `instagram:VIDEO_PROPRIO:AGUARDANDO_MIDIA_AUTORIZADA`;
- o ciclo criaria **5 dependências `SINCRONIZAR_MIDIA_AUTORIZADA` humanas,
  todas WAITING, e 0 jobs de geração**;
- nada foi gravado: `AutomationJob` 5→5, `Conteudo` 22→22.

## 2. Como ficou a fila quando falta mídia

Usei um tipo que já existe, `SINCRONIZAR_MIDIA_AUTORIZADA`, com um contexto
que o distingue da sincronização com o provider:
`origemDaMidia: 'DA_DONA'`, `formato: 'VIDEO_PROPRIO'` e `canal`.

| | Valor |
|---|---|
| Estado inicial | **`WAITING`** — não é reivindicável |
| Classe | **`EXIGE_HUMANO`** — o painel mostra "preciso de você" |
| Motivo humano | `MISSING_AUTHORIZED_MEDIA`, que já existia no vocabulário |
| Tentativas | **0**; o executor passa por ela sem gastar nada |
| `GERAR_CONTEUDO` | **nenhum** é criado |
| Retry do ciclo | mesma chave, mesma linha — testado com duas voltas |

O perfil contextual mora em `perfilContextual()`, ao lado do caso
`COMPLETAR_DADO_DO_PRODUTO`, que já seguia esse padrão.

Os 5 jobs `GERAR_CONTEUDO` da P1.8 já estão em `SUCCEEDED`, que é terminal.
O próximo ciclo não os toca. Se algum job antigo desse tipo voltar à fila,
ele termina como obsoleto.

## 3. Como ficou a cadeia de direitos no FFmpeg

O módulo novo é `lib/cadeia-de-direitos.ts`. A regra:

> O derivado não tem direito próprio. Ele herda o das fontes, e só se
> **todas** valerem. Uma fonte sem direito bloqueia o arquivo inteiro.

**O registro.** Cada derivado ganha um `direito_da_midia` de origem
`DERIVADO` com:
- `fontes[]`, uma por mídia usada, cada uma com a sua evidência;
- `geracaoId`, o job que gerou.

Ele fica em `Conteudo.alertasCompliance`, sem coluna nova. **O registro é
gravado mesmo quando o derivado sai bloqueado**: é proveniência, e é o que
explica depois por que aquele vídeo não pode ir ao ar.

**Quando uma fonte tem direito:**

| Fonte | Tem direito quando |
|---|---|
| Imagem do produto | cadastro diz "Próprio", o produto permite derivar **e** o arquivo está no storage do projeto |
| Vídeo da dona | tem o próprio registro `PROPRIO` |
| Sintetizado pelo Patrono (fundo, texto, voz) | `GERADO_PELO_PATRONO` com o id da geração |
| "Gerado por IA" no cadastro | **não basta** — falta a prova da geração |
| `comprei_e_testei`, Shopee, fornecedor | **nunca** |
| Imagem em CDN de marketplace | **nunca**, seja qual for a declaração |

**Duas respostas separadas.** O registro responde `fontesAutorizadas` (a
cadeia vale?) e `publicavel` (e o arquivo final está em custódia pública?).
Uma prévia privada pode ter fontes legítimas e mesmo assim não ser
publicável.

**Onde está ligado.** No único render FFmpeg real, `processarProductPreview`:
- fonte da imagem do produto, ou fundo neutro;
- voz sintetizada, com a data em que a dona aprovou a voz;
- texto sobreposto.

**Sem migration.**

## 4. Preço

A janela de 3 dias da P1.9.1 **não tinha base objetiva**. Nenhum dado do
projeto mede com que frequência os preços mudam. Ela virou configuração:

| | |
|---|---|
| Variável | `PRECO_VALIDADE_HORAS`, inteiro de 1 a 168 |
| Padrão | **24 horas** |
| Inválido ou fora da faixa | cai no padrão; nunca amplia o prazo |
| Origem visível | `validadeDoPreco().origem`: `CONFIGURADA`, `PADRAO` ou `PADRAO_POR_VALOR_INVALIDO` |

O padrão é conservador no sentido que importa: o erro possível é omitir um
preço válido, nunca afirmar um vencido. A regra de data continua: só
`sincronizadoEm` conta, e nada é inventado. Hoje nenhum produto tem
`sincronizadoEm`, então, com qualquer prazo, nenhuma legenda afirma preço.
O prazo deve ser recalibrado com dado quando existir sincronização real de
preço.

## 5. Como ficou a confirmação do link na bio

O módulo novo é `lib/link-na-bio.ts`. O preflight agora separa três coisas
no campo `link`:

| | Campo | Como se obtém |
|---|---|---|
| Estratégia definida | `estrategia: 'BIO'` | declaração do canal |
| Link rastreado gerado | `gerado` | o `LinkDinamico` existe, então o redirect responde |
| Link colocado na bio | `estado: 'CONFIRMADO'` | **confirmação humana** |

**Estados possíveis:**
- `LINK_INDISPONIVEL`
- `LINK_NAO_GERADO`
- `AGUARDANDO_CONFIRMACAO`
- `CONFIRMADO`
- `NAO_SE_APLICA`

**`executavelAgora` só fica `true` com `CONFIRMADO`.** O bloqueio novo é
`LINK_NA_BIO_NAO_CONFIRMADO`, e ele vem antes de `ADAPTER_DESLIGADO` na
ordem, porque confirmar é o passo humano que precede ligar o canal.

**A confirmação** (`confirmarLinkNaBio`, ou o script
`scripts/confirmar-link-na-bio.ts`):
- exige um usuário **deste** workspace;
- vale para **uma URL**, a desta tentativa. Republicar gera link novo, e o
  link novo exige confirmação nova;
- é recusada se o link ainda não foi gerado, porque colar na bio daria 404;
- grava o registro na peça **e** no `AuditLog` (`link_na_bio.confirmado`);
- o script exige a flag `--eu-vi-o-link-na-bio`.

**Também no orquestrador.** `distribuirConteudo` confere a confirmação
**antes** de criar a `Publicacao`: esperar não deixa rastro. Depois de obter
a tentativa, confere de novo se o link é o mesmo que foi confirmado.

**O link é gerado antes, de verdade.** `gerarLinkParaABio` cria o
`LinkDinamico` sem `Publicacao`, para a bio nunca apontar para um 404. A
publicação reaproveita o mesmo link pelo slug e o vincula. O teste confirma:
uma `Publicacao` e um `LinkDinamico`.

**Correção de passagem.** O dry run usava `dataAgendamento: null` na chave
padrão. Numa peça agendada, ele mostrava um link diferente do que sairia.
Agora usa o agendamento real.

## 6. A porta única — o achado grave

Duas rotas publicavam no Instagram sem passar por nada das P1.5–P1.9.1:

| Rota | O que fazia |
|---|---|
| `app/api/conteudos/[id]/publicar` (botão "Publicar") | publicava Reel, **imagens do produto em carrossel** e stories, sem preflight, sem flag, sem direito de mídia |
| `app/api/cron/publicar` | publicava todo conteúdo `agendado` com vídeo |

Ou seja, a flag `PUBLICACAO_REAL_INSTAGRAM` nunca foi "o único bloqueio". O
botão da tela a ignorava, e teria publicado as fotos de vendedor da Shopee
como carrossel.

**A correção.** O módulo novo é `lib/porta-de-publicacao-real.ts`. As duas
rotas chamam `autorizarPublicacaoReal()` **antes de qualquer conexão com a
Meta**, e ela libera somente quando `preflight.executavelAgora` é verdadeiro:
conta, peça, mídia, copy, preço, flag e link confirmado. Além disso:

- imagens, carrossel e stories são recusados com
  `ENVIO_NAO_SUPORTADO_PELO_ADAPTER`;
- preflight que quebra não libera nada (`PREFLIGHT_INDISPONIVEL`);
- no cron, um agendado bloqueado fica `agendado` e não é marcado como
  publicado;
- a legenda passa a ser a que o preflight aprovou. Antes, a rota a remontava,
  duplicando a CTA e colando uma URL não clicável.

**Em produção hoje: 0 conteúdos `agendados`.** Não há indício de que alguma
das rotas tenha sido usada desde a P1.7.

## 7. Migration

**Nenhuma.** Tudo coube em estruturas existentes: `Conteudo.alertasCompliance`
para a cadeia de direitos e a confirmação da bio, `AuditLog` para a
auditoria, `LinkDinamico` para o link reservado.

## 8. Testes

| | |
|---|---|
| Suíte (`tsx --test tests/*.test.ts`) | **1.860 testes, 1.860 passando, 0 falhas** |
| Antes desta rodada | 1.814 |
| Novos | **+46** (`tests/rodada49-pipeline-publicavel.test.ts`: 43; mais 3 nas rodadas 35, 41 e 45) |
| `npx tsc --noEmit` | **exit 0** |
| `next build` | **exit 0** |
| Banco | teste autorizado `xntkypjmmdovrfbblbqb`, ref conferida antes de cada execução |

**Cobertura dos itens pedidos:**

| Item | Onde |
|---|---|
| planner não escolhe formato incompatível (varredura) | rodada49, rodada35, rodada45 |
| falta de mídia vira WAITING, não conteúdo inútil | rodada49 (ciclo real), rodada44, rodada47 |
| retry não duplica job | rodada49 (duas voltas do ciclo) |
| mídia própria permite avançar | rodada49, rodada47 |
| mídia Shopee bloqueia (peça e derivado) | rodada49 |
| derivado FFmpeg preserva o direito da origem | rodada49 (6 casos + o render real grava a cadeia) |
| link não confirmado bloqueia a execução | rodada49 (preflight e orquestrador), rodada41 |
| confirmação humana libera, auditada | rodada49 |
| outro workspace isolado | rodada49 (preflight, confirmação, peça) |
| zero publicação | rodada49 (`fetch` espião: 0 chamadas) |
| Reel validado em **MP4 real** | `tests/fixtures/reel/` (vertical, deitado, curto, rotacionado) |
| validade do preço configurável | rodada49 |

**Testes antigos alterados, e por quê.** As rodadas 35, 39, 40, 44 e 45
usavam o Instagram como canal **genérico** para testar a mecânica da fábrica
e do planner. Passaram a usar `facebook`, que tem as mesmas capacidades de
plataforma e não tem adapter real. A regra do Instagram ganhou testes
próprios.

Os e2e das rodadas 44 e 47 afirmavam que o ciclo geraria `TEXTO_COM_LINK`
para o Instagram — o comportamento que esta rodada elimina. Foram
reescritos para o fluxo real: dependência humana → vídeo próprio → link →
confirmação → preflight.

Nas rodadas 41, 43, 44 e 48, os testes de mecânica de distribuição fazem o
passo da bio pelo caminho real (`confirmarLinkNaBioParaTeste`). Os testes de
bloqueio chamam a distribuição sem ele.

## 9. O que você precisa fazer para fornecer o primeiro vídeo

Produto: **Colchão Inflável Automático MODOFO**
(`cmoyvjp2s001712gyczbipb32`), workspace `ws_05a6d536ef185f39b738`, seu
usuário `cmoyrhzq30000bj6j6fp3792t`.

**1. Gravar.**
- Celular **na vertical**.
- **10 a 30 segundos**.
- O colchão inflando sozinho, na sua casa.
- **Sem música**: use o som ambiente ou nenhum.
- **Sem pessoas além de você, sem crianças.**
- Sem tela da Shopee.
- Não diga "original", "garantido" ou "o melhor".

No iPhone, H.264 e HEVC são aceitos. O script lê o arquivo e diz
exatamente o que estiver fora: proporção, duração, codec, tamanho (até 100 MB).

**2. Copiar o arquivo para o computador.** Por exemplo:
`C:\Users\jurid\Desktop\colchao.mp4`.

**3. Prévia.** Não grava nada. Pode me pedir, ou rodar com o `.env.local`
carregado:
```
npx tsx scripts/preparar-peca-midia-propria.ts \
  --workspace ws_05a6d536ef185f39b738 --produto cmoyvjp2s001712gyczbipb32 \
  --declarado-por cmoyrhzq30000bj6j6fp3792t \
  --arquivo "C:\Users\jurid\Desktop\colchao.mp4" \
  --descricao "vídeo que gravei do colchão inflando" \
  --declaro-gravado-por-mim --declaro-sem-musica-de-terceiros \
  --declaro-sem-terceiros-nem-criancas
```
As três `--declaro-...` são afirmações suas e ficam gravadas com a evidência.
Só as passe se forem verdade.

**4. Gravar.** É o mesmo comando, mais `--gravar`. Ele:
- sobe o vídeo para o seu storage (bucket `videos`);
- registra o direito e grava **uma** peça;
- gera o link rastreado e mostra o preflight.

Nada é publicado.

**5. Colar o link na bio.** O script imprime a URL. No Instagram: Editar
perfil → Links → colar.

**6. Confirmar.** Abra o perfil, veja o link e rode o comando que o script
imprime (`scripts/confirmar-link-na-bio.ts ... --eu-vi-o-link-na-bio`). O
preflight passa a mostrar só `ADAPTER_DESLIGADO`.

**7. Parar.** Publicar é a próxima rodada, com a flag ligada só durante a
janela.

Se preferir subir o vídeo pela tela de Conteúdos, use `--video-url` no lugar
de `--arquivo`. O script baixa o vídeo só para validar.

## 10. O que fica, nomeado

1. **O vídeo FFmpeg não chega à peça.** O render real grava prévia privada,
   e a cadeia é registrada. Para o FFmpeg virar formato publicável, o render
   precisa gravar o MP4 em custódia pública e na `Conteudo.videoUrl` — e só
   então `MIDIA_ENTREGUE_PELA_FABRICA` muda.
2. **A confirmação da bio é humana.** Conferir a bio pela Graph API
   (`website` do perfil) seria uma chamada à Meta, que não foi feita nesta
   rodada.
3. **Uma bio guarda um link.** Para vários posts ao mesmo tempo seria
   preciso uma página de "links da bio", que não foi construída.
4. **O upload pelo script usa a mesma chave pública da tela.** Se o bucket
   `videos` recusar, use o caminho `--video-url`.
5. **Os testes `.mjs`** exigem o app rodando em `localhost:3100` e não foram
   executados, como nas rodadas anteriores.

## Confirmação de zero publicação

| | |
|---|---|
| `PUBLICACAO_REAL_INSTAGRAM` | nunca ligado |
| `ADAPTADORES_LIGADOS` | `{}` |
| Chamada à Meta | **nenhuma**; nas suítes novas, `fetch` bloqueado: 0 chamadas |
| Escrita em produção | **nenhuma**; só leituras (ensaio do ciclo, IDs) |
| `Publicacao` / `LinkDinamico` / `Conteudo` / `AutomationJob` em produção | 0 / 126 / 22 / 5 — iguais ao início |
| ML / provider pago / TikTok | intocados |
| `main` | sem merge, sem sync |

Paro aqui para revisão.
