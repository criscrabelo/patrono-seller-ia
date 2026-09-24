# P1.7.5 — Dry run real em produção

**Executado. `HTTP 200` em 6,3 s, `escreveu: false`, todos os oito deltas em
zero. Os números reais do Patrono estão abaixo.**

Data: 24/09/2026 · Commit `b85162d` · `https://patrono-seller-ia.vercel.app`

---

## 1. `CRON_SECRET`

| | |
|---|---|
| Gerado | localmente, **48 bytes** de entropia (`crypto.randomBytes`), base64url, 64 caracteres |
| Exibido | **em lugar nenhum** — nem terminal, nem relatório, nem chat |
| Impressão digital | `4f419052` (8 primeiros hex do sha256 — serve só para conferir que os dois lados têm o mesmo valor) |
| Guardado em | `C:\Users\jurid\patrono-secrets\CRON_SECRET.txt` — fora do repositório e fora do OneDrive |
| **Vercel → Production** | **gravado**, tipo Secret. Produção passou de 11 para **12 variáveis** |
| **GitHub Actions** | **NÃO gravado** — ver abaixo |

Um redeploy foi necessário para a variável valer (`66 s`, exit 0).

### O que ficou pendente no GitHub, e por quê

O `gh` CLI **não está instalado** nesta máquina e não há token do GitHub no
ambiente. A única credencial disponível é a do Git Credential Manager, usada
para `git push` — usá-la para escrever segredos via API seria esticar
bastante o que ela existe para fazer, e eu preferi não.

**Isso não bloqueou nada nesta rodada:** o segredo do GitHub só é necessário
quando os schedules forem ligados, o que depende do merge para `main` — que
você vedou aqui. O ensaio desta rodada foi uma chamada manual autenticada
contra a Vercel.

**Os dois passos que faltam, quando você quiser ligar os schedules:**

1. GitHub → Settings → Secrets and variables → Actions → **New repository
   secret** → nome `CRON_SECRET`, valor copiado de
   `C:\Users\jurid\patrono-secrets\CRON_SECRET.txt`.
2. Na aba **Variables**, → `PATRONO_BASE_URL` =
   `https://patrono-seller-ia.vercel.app`.

Para conferir que colou o valor certo, o sha256 do que estiver no GitHub tem
de começar com `4f419052`.

## 2. Autenticação validada

| Caso | Resposta |
|---|---|
| Sem `Authorization` | **401** `{"error":"Não autorizado"}` |
| `Bearer` inválido | **401** `{"error":"Não autorizado"}` |
| `Bearer` correto | **200**, `ok: true`, `modo: "ENSAIO — nada gravado"` |

O valor nunca passou pelo terminal: foi lido do arquivo direto para o header
do `curl`.

## 3. O ensaio

```
GET /api/cron/oportunidades?modo=ensaio
HTTP 200 em 6,34 s
```

```json
{
  "ok": true,
  "modo": "ENSAIO — nada gravado",
  "escreveu": false,
  "executadoEm": "2026-09-24T17:54:40.231Z",
  "capacidades": { "FFMPEG": false, "DIGITAL_TWIN_GPU": false,
                   "PROVEDOR_PAGO_AUTORIZADO": false },
  "workspaces": 1,
  "oportunidadesAvaliadas": 20,
  "itensDePlano": 5,
  "jobsDesejados": 5,
  "jobsCriados": 5,
  "jobsMantidos": 0,
  "jobsCancelados": 0,
  "nasceriamWaiting": 0,
  "lacunasDeFormato": 0,
  "recusados": 0,
  "erros": 0,
  "custoTotal": 0,
  "publicacaoAutonoma": "DELIBERADAMENTE_FORA_DE_ESCOPO",
  "execucaoAutonoma": "DELIBERADAMENTE_FORA_DE_ESCOPO"
}
```

## 4. Contagens antes/depois — todos os deltas em zero

| Tabela | Antes | Depois | Delta |
|---|---|---|---|
| `AutomationJob` | 0 | 0 | **+0** |
| `Conteudo` | 17 | 17 | **+0** |
| `Publicacao` | 0 | 0 | **+0** |
| `LinkDinamico` | 126 | 126 | **+0** |
| `EventoLink` | 0 | 0 | **+0** |
| `MLModel` | 0 | 0 | **+0** |
| `MLTrainingRun` | 0 | 0 | **+0** |
| `MLFeatureSnapshot` | 0 | 0 | **+0** |

`OK — nenhuma contagem mudou. O ensaio nao escreveu nada.` · exit 0

`MLTrainingRun` entrou na verificação nesta rodada, a pedido seu — e foi um
bom acréscimo: contar `MLModel` prova que nenhum modelo foi **promovido**,
mas não que nenhum treino **rodou**. São garantias diferentes.

## 5. Resultado comercial — os números reais

### Workspace

Um só: `ws_05a6d536ef185f39b738`.
**Canais conectados: `instagram`, `hotmart`, `shopee`.**

### Catálogo

| | |
|---|---|
| Produtos cadastrados | **25** |
| `status = ativo` | 22 |
| `status = descartado` | 3 |
| Entraram na fila de oportunidades | **20** |

Os 3 descartados saem por status. **Os outros 2 que não entraram na fila eu
não isolei** — medir isso exigiria instrumentar o motor, e não quis inventar
uma explicação. Fica registrado como pendência.

### Oportunidades e seleção

| | |
|---|---|
| Oportunidades avaliadas | **20** |
| Oportunidades comerciais | **20** |
| Prontas para publicação | **0** |
| Selecionadas para o plano | **5** |
| Jobs que seriam criados | **5** |
| Jobs mantidos / cancelados | 0 / 0 |
| Nasceriam `WAITING` | **0** |
| Lacunas de formato | **0** |
| Recusados | **0** |
| Erros | **0** |

### Os 5 selecionados

| # | Produto | Categoria | Score | Prioridade | Canal / Formato |
|---|---|---|---|---|---|
| 1 | Robô Aspirador H40 110V/220V Original Lacrado | Eletrodomésticos | 46 | 24,84 | instagram / `TEXTO_COM_LINK` |
| 2 | Colchão Inflável Automático MODOFO Casal/Queen/King | Casa e Decoração | 34 | 18,36 | instagram / `TEXTO_COM_LINK` |
| 3 | Trem Locomotiva Maria Fumaça Deluxe com Luz Som e Fumaça | Brinquedos | 23 | 12,42 | instagram / `TEXTO_COM_LINK` |
| 4 | Colete Salva Vidas Infantil Prolife Homologado | Esporte e Lazer | 21 | 11,34 | instagram / `TEXTO_COM_LINK` |
| 5 | Boneca Fada Voadora com Sensor Brinquedo Fadinha Mágica | Brinquedos | 19 | 10,26 | instagram / `TEXTO_COM_LINK` |

Todos os cinco: `estado = PRONTO_PARA_GERAR_CONTEUDO`, `próxima ação =
GERAR_CONTEUDO`, `podeExecutarAutomaticamente = true`, `confiança =
SEM_HISTORICO_REAL`.

**Os 5 jobs nasceriam `PENDING`, nenhum `WAITING`** — `TEXTO_COM_LINK` roda
sem FFmpeg e sem GPU, então nada fica esperando capacidade.

### Por que todos escolheram `TEXTO_COM_LINK`

Os cinco itens trazem `bloqueios: ["MIDIA_SEM_DIREITO"]`. Não é contradição
com `PRONTO_PARA_GERAR_CONTEUDO`: o bloqueio impede **compor vídeo ou imagem
a partir da mídia do produto**, não impede publicar um texto com link
rastreado. O plano então escolhe o formato que o direito permite.

E aqui está o achado que mais vale desta rodada.

### Os 15 que ficaram de fora

Não foram recusados — **o plano corta no topo da fila**, por prioridade:

```
score 18  Power Bank 20000mAh
score 17  Sapatilha Aquática Infantil 17-32 Antiderrapante Neoprene
score 16  Kit Jogo 04 Copos Cactus 240ml Vidro Verde
score 16  50 Embalagens para Caneca Cerâmica 325ml Kraft
score 15  Sabonete em Folhas Portatil Perfumado Kit 3 Unidades
score 15  Fio de Juta Lurex Dourado
score 13  Granado Carioca Vela Perfumada 180g
score 13  Percarbonato De Sódio 100% ECO CLEAN
… e mais 7
```

### Receita potencial

**Não há base para estimar, e não vou inventar um número.**

| Sinal necessário | Valor real |
|---|---|
| Cliques medidos | **0** |
| Publicações feitas | **0** |
| Amostras de ML | **0** |
| Confiança dos itens | `SEM_HISTORICO_REAL` nos 5 |

O próprio sistema classifica a confiança como sem histórico real. Qualquer
projeção hoje seria multiplicar suposição por suposição.

## 6. Dados ausentes que impedem decisão melhor

### O maior: o vocabulário de `origemConteudo`

A regra de direitos de mídia (`lib/media-rights-produto.ts`) reconhece
quatro origens, e **origem não reconhecida nunca vira "permitido por
omissão"** — é fail-closed, por desenho:

| Valor reconhecido | Direito |
|---|---|
| `Próprio` | **derivar permitido** |
| `Gerado por IA` | **derivar permitido** |
| `Licenciado` | desconhecido |
| `De fornecedor` | desconhecido |
| qualquer outro | **desconhecido** |

O que está no catálogo de produção:

| `origemConteudo` | Produtos | Direito de derivar |
|---|---|---|
| `Shopee` | **10** | não — fora do vocabulário |
| `comprei_e_testei` | **9** | não — fora do vocabulário |
| `De fornecedor` | 4 | não |
| `Licenciado` | 1 | não |
| `Gerado por IA` | **1** | **sim** |

**Um produto de 25 pode ter vídeo composto a partir da própria mídia.**

Os 9 marcados `comprei_e_testei` são os que mais chamam atenção: se essas
fotos foram tiradas por você, o valor correto no vocabulário é `Próprio`, e
mudá-lo **destrava formato de vídeo para 9 produtos sem uma linha de código
nova**. Não mexi em nada — isso é declaração de direito sobre mídia, e quem
declara é você, não eu. Mas é, de longe, a alavanca mais barata à vista.

### Os demais

| Lacuna | Quantidade |
|---|---|
| Produtos sem vídeo autorizado | **15 de 25** |
| Produtos sem `linkProduto` | **9 de 25** |
| Produtos sem preço | **4 de 25** |
| Produtos sem imagem | 1 de 25 |
| `tipoVenda` inconsistente | `afiliado` (9) e `Afiliado` (1) — mesmo conceito, caixa diferente |
| Cliques, publicações, amostras de ML | **0, 0, 0** |

A inconsistência de caixa em `tipoVenda` não quebrou nada hoje, mas é o
mesmo tipo de armadilha do `origemConteudo`: texto livre onde o código
espera vocabulário.

## 7. Segurança — tudo preservado

| | |
|---|---|
| `automationPaused` | **`true`** |
| `automationMode` | **`MANUAL`** |
| `ADAPTADORES_LIGADOS` | `{}` |
| `RENOVADORES_LIGADOS` | `{}` |
| `PUBLICACAO_REAL_*` em produção | **ausente** |
| `PROVEDOR_PAGO_AUTORIZADO` | `false` — cravado no código, não lido do ambiente |
| `custoTotal` da execução | **0** |
| ML | shadow mode — `MLModel`, `MLTrainingRun` e `MLFeatureSnapshot` em 0 |
| `Publicacao` | **0 linhas** |

### Os schedules continuam inertes

| | |
|---|---|
| Branch atual | `claude/pronto-para-trabalhar-jiij19` |
| `main` | **intocada** — segue em `6acdd7b`, sem merge e sem sync |
| `vercel.json` | `{}` — nenhum cron na Vercel |
| GitHub Actions | `schedule` só dispara na branch padrão, e o workflow não está lá |
| Secret no GitHub | não criado — o workflow encerraria em silêncio de qualquer forma |

**Não existe caminho por onde um cron dispare sozinho.** Mesmo com
`CRON_SECRET` em produção, a Vercel não tem o que agendar e o GitHub não
tem o workflow na branch que agenda.

## 8. Confirmações

| | |
|---|---|
| Ensaio executado | **sim** — `HTTP 200`, uma única chamada |
| `escreveu` | **`false`** |
| Escrita operacional | **zero** — 8 tabelas, 8 deltas em zero |
| Publicação | **zero** |
| Instagram / TikTok real | **zero** |
| Provider pago | **zero** |
| Treino / promoção de ML | **zero** |
| Schedules ativos | **nenhum** |
| Merge / sync da `main` | **nenhum** |
| `CRON_SECRET` na Vercel | **criado** |
| `CRON_SECRET` no GitHub | **pendente** — `gh` indisponível |
| Segredo exibido | **nunca** |
| **Custo** | **R$ 0,00** |

---

## Próximo passo mínimo para começar operação real

Três coisas, em ordem, e a primeira não é técnica:

**1. Corrigir o `origemConteudo` dos 9 produtos `comprei_e_testei`.** Se a
mídia é sua, o valor é `Próprio`. Isso sozinho tira 9 produtos do
`TEXTO_COM_LINK` obrigatório e abre vídeo — mudando dado, não código. É a
sua decisão porque é declaração de direito.

**2. Reconectar o Instagram informando App ID e App Secret.** Hoje o
preflight para em `SCOPE_NAO_VERIFICAVEL`: existe token, mas a plataforma
não confirmou o escopo. Com o `debug_token` funcionando, o preflight sai
para `pronto: true` sem uma linha nova.

**3. Rodar o cron uma vez em modo de operação** — sem `?modo=ensaio` — para
os 5 jobs entrarem de fato na fila, e deixar o executor gerar as 5 peças. O
conteúdo fica pronto e **nada vai ao ar**, porque publicar ainda depende de
`PUBLICACAO_REAL_INSTAGRAM=true`, que não existe.

Só depois disso a primeira publicação real faz sentido — e é ela que
fecha o ciclo: link rastreado → clique → venda → amostra rotulada → ML.
Enquanto não houver clique, o `SEM_HISTORICO_REAL` dos cinco itens continua
sendo a verdade.

Paro aqui para sua revisão.
