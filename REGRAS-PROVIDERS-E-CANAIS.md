# Regras por Provider e Canal — Patrono Seller

**Criado:** 14/09/2026 — Rodada 4 do P0.

Este documento registra, por plataforma, o que sabemos hoje sobre o que pode ser automatizado, o que exige autorização, e o que não pode ser automatizado de forma nenhuma. É a versão em texto corrido de `lib/affiliate-provider-capabilities.ts` (providers de afiliados) e `lib/channel-registry.ts` (canais de publicação).

**Regra de pesquisa (seguida à risca neste documento):** para cada linha, priorizar documentação oficial. Quando a regra não pôde ser confirmada contra uma fonte ao vivo — este ambiente de desenvolvimento não tem acesso à internet externa nesta rodada — o campo diz **A VERIFICAR**, nunca um "sim" por suposição. Nada aqui foi decidido só por conhecimento geral do modelo sem marcar essa limitação.

---

## Como ler este documento

| Coluna | Significado |
|---|---|
| Podemos automatizar hoje | O que já está implementado e funcionando de verdade no código |
| Exige autorização | Existe caminho oficial, mas precisa de credencial/aprovação que não temos configurada |
| Não podemos automatizar | Proibido pela própria plataforma, ou não existe caminho oficial conhecido |
| Pendências | O que falta verificar/implementar |

---

## Providers de afiliados

### Amazon Associados
- **Fonte oficial utilizada:** conhecimento geral sobre o Product Advertising API (PA-API) — **A VERIFICAR** contra a documentação atual antes de qualquer implementação real.
- **Podemos automatizar hoje:** nada ainda (sem credenciais configuradas).
- **Exige autorização:** catálogo/preço/link via PA-API — precisa de conta de Associados aprovada e volume mínimo de vendas para manter acesso.
- **Não podemos automatizar:** nada identificado além da exigência de aprovação de conta.
- **Pendências:** confirmar termos atuais do PA-API, limites de chamada, e o processo de aprovação da conta.

### Mercado Livre
- **Fonte oficial utilizada:** conhecimento geral de que existe uma API de desenvolvedores pública — **NÃO VERIFICADO** se ela cobre tendências/mais-vendidos, nem se o programa de afiliados usa essa mesma API para gerar link.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** provavelmente catálogo/produtos via API pública — A VERIFICAR.
- **Não podemos automatizar:** geração de link de afiliada fora do mecanismo oficial do programa (nunca fabricar link manualmente fingindo ser de afiliado).
- **Pendências:** ler a documentação oficial do Mercado Livre Developers e do programa de afiliados antes de qualquer implementação.

### Shopee
- **REGRA CRÍTICA (inegociável):** nenhuma automação de navegador, nenhuma raspagem de página da Shopee, em nenhuma hipótese — nem para produtos, nem rankings, nem imagens, nem preços, nem criativos.
- **Fonte oficial utilizada:** nenhuma consultada nesta rodada.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** API oficial de afiliados/catálogo, se existir para nossa conta — A VERIFICAR.
- **Não podemos automatizar:** qualquer coisa que dependa de scraping ou automação de navegador.
- **Pendências:** confirmar se existe API oficial de afiliados acessível; até lá, o funcionamento continua 100% manual (cadastro do link feito pela própria usuária).

### TikTok Shop
- **Fonte oficial utilizada:** nenhuma consultada nesta rodada.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** provavelmente uma API de sellers/afiliados — A VERIFICAR.
- **Não podemos automatizar:** nada identificado além da falta de verificação.
- **Pendências:** ler a documentação oficial do TikTok Shop Partner Center.

### Hotmart
- **Fonte oficial utilizada:** conhecimento geral de que a Hotmart documenta publicamente uma API de produtos/vendas/comissões e webhook de venda.
- **Podemos automatizar hoje:** nada (sem app/credenciais registrados).
- **Exige autorização:** toda a API — precisa registrar um app e ter credenciais aprovadas.
- **Não podemos automatizar:** nada identificado.
- **Pendências:** registrar o app na Hotmart e confirmar os escopos exatos antes de implementar.

### Favoritos Renner / Riachuelo / Netshoes
- **Fonte oficial utilizada:** nenhuma consultada nesta rodada.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** desconhecido — provavelmente operam por uma rede de afiliação parceira (qual rede, não confirmado).
- **Não podemos automatizar:** scraping do site do varejista.
- **Pendências:** identificar qual rede de afiliação cada varejista usa hoje (se ainda for a mesma) antes de prometer qualquer automação.

### Sephora (via Rakuten Advertising) / Rakuten Advertising / Awin / Impact / CJ Affiliate
- **Fonte oficial utilizada:** conhecimento geral de que essas quatro redes documentam publicamente APIs de publisher (relatórios, deep-link, e nos três últimos, webhooks de conversão).
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** toda a API — precisa de conta de publisher aprovada pela rede e, em alguns casos, pelo anunciante específico dentro dela.
- **Não podemos automatizar:** nada identificado além da aprovação.
- **Pendências:** confirmar os termos e limites atuais de cada rede antes de implementar; cada anunciante dentro da rede pode ter regra de conteúdo própria.

### Lomadee / Monetizze / Eduzz / Kiwify / Magalu Parceiro
- **Fonte oficial utilizada:** nenhuma consultada ao vivo nesta rodada — apenas conhecimento histórico geral, marcado como **NOT_VERIFIED**.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** desconhecido até reverificação.
- **Não podemos automatizar:** nada identificado.
- **Pendências:** reconferir contra a documentação oficial atual de cada um antes de qualquer implementação.

---

## Canais de publicação

### Instagram
- **Fonte oficial utilizada:** Meta Graph API — **já em uso real** no projeto (`lib/instagram.ts`).
- **Podemos automatizar hoje:** publicação de imagem, carrossel, Reels e Stories via Graph API, com gate de aprovação humana antes de publicar (já implementado, rodadas anteriores).
- **Exige autorização:** token de app Meta configurado pela usuária (já é o fluxo atual).
- **Não podemos automatizar:** nada além da própria exigência de token/app da Meta.
- **Pendências:** reconferir limites exatos de tamanho/duração por tipo de conta antes de mudar qualquer regra.

### TikTok
- **Fonte oficial utilizada:** conhecimento geral de que existe uma Content Posting API oficial — nenhuma chamada real feita nesta rodada.
- **Podemos automatizar hoje:** nada (sem credenciais).
- **Exige autorização:** toda publicação — e a própria API do TikTok exige consentimento explícito do criador antes de publicar (não é algo que dá pra contornar).
- **Não podemos automatizar:** publicação sem o consentimento do criador; nunca hardcodar limite de duração — deve vir da própria API (creator info) quando implementado (ver `TikTokPreflightValidator`, `lib/tiktok-preflight.ts`).
- **Pendências:** registrar app no TikTok for Developers, confirmar escopos, e então implementar o `TikTokPreflightValidator` de verdade.

### YouTube (Shorts)
- **Fonte oficial utilizada:** conhecimento geral de que existe a YouTube Data API (upload).
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** toda a API (OAuth do canal).
- **Não podemos automatizar:** nada identificado além da autorização.
- **Pendências:** não implementado; reconferir limites de duração/tamanho antes de implementar.

### Facebook
- **Fonte oficial utilizada:** mesma família de API (Meta Graph API) do Instagram.
- **Podemos automatizar hoje:** nada — só o Instagram está implementado hoje, Facebook não.
- **Exige autorização:** mesmo token de app Meta, com permissões adicionais para páginas do Facebook.
- **Não podemos automatizar:** nada identificado.
- **Pendências:** decidir se vale a pena implementar Facebook como canal separado (mesma infraestrutura do Instagram).

### Pinterest
- **Fonte oficial utilizada:** conhecimento geral de que existe uma API de Pins pública.
- **Podemos automatizar hoje:** nada.
- **Exige autorização:** toda a API.
- **Não podemos automatizar:** nada identificado.
- **Pendências:** não implementado, não reconferido.

---

## Regra permanente

Nenhuma automação real (conexão, importação, publicação) deve ser ativada para nenhuma linha acima enquanto ela estiver marcada **A VERIFICAR** ou **NOT_VERIFIED**. Antes de implementar qualquer uma, reler a documentação oficial da plataforma, atualizar `lastVerifiedAt` no registro correspondente (`lib/affiliate-provider-capabilities.ts` ou `lib/channel-registry.ts`), e só então trocar `status`/`sourceType`.
