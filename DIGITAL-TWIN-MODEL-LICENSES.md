# Digital Twin — Licenças de Modelos Avaliados

**Criado:** Rodada 7 (Digital Twin Real).

**Regra de pesquisa:** este ambiente de desenvolvimento não tem acesso à internet externa nesta rodada — toda linha reflete o conhecimento disponível sobre cada projeto no momento em que a Rodada 7 foi escrita, registrado como **A VERIFICAR** onde não há confirmação ao vivo contra a documentação/licença atual. Antes de instalar qualquer um em produção, reconferir a licença/termos vigentes.

| Modelo | Função | Licença código | Licença pesos | Comercial | GPU | Decisão |
|---|---|---|---|---|---|---|
| **Chatterbox TTS** (Resemble AI, oficial) | Clonagem de voz (voice cloning), TTS | MIT | MIT (conforme repositório oficial) | Sim — self-hosted | CPU funciona, GPU acelera | **ADOTADO** (self-hosted apenas — nunca a API paga da Resemble). `verificarDisponibilidadeChatterbox()` — não instalado neste ambiente nesta rodada. |
| **MuseTalk** | Lip-sync (sincronização labial) | MIT (código) | Modelos informados pelo projeto como disponíveis para uso comercial — **A VERIFICAR** antes de produção | Sim, conforme informado pelo projeto | GPU recomendada (VRAM ainda não medida neste ambiente) | **CANDIDATO PRINCIPAL** (`AVAILABLE_CANDIDATE`). `verificarDisponibilidadeMuseTalk()` — não instalado neste ambiente nesta rodada. Reconferir a licença de cada dependência efetivamente usada antes de integrar em produção. |
| **Wav2Lip** (tradicional, projeto original) | Lip-sync | Código com uso restrito conforme o projeto original | Modelos publicados restritos a uso pessoal/acadêmico/pesquisa/não comercial | **NÃO** — incompatível com finalidade comercial do Patrono | GPU | **BLOCKED_BY_LICENSE** — nunca integrado (`lib/lipsync-provider.ts`, `bloquearMotor()` impede uso mesmo por engano). |
| **LivePortrait** | Geração/animação de retrato (avatar) | Mista — cadeia de dependências inclui componentes de detecção facial com restrições comerciais não totalmente esclarecidas | Não totalmente esclarecida nesta rodada | **NÃO CONFIRMADO** | GPU | **BLOCKED_BY_LICENSE** nesta rodada — só reavaliar se TODA a cadeia de dependências for confirmada compatível com uso comercial. |

## Regra permanente

Nenhum motor listado como `BLOCKED_BY_LICENSE` pode ser integrado, mesmo que tecnicamente funcione no ambiente — a decisão é sobre licença, não sobre capacidade técnica. Qualquer novo candidato entra nesta tabela **antes** de qualquer linha de código de integração ser escrita, com a mesma coluna de decisão.

## Dependências pesadas (regra 49)

Nenhum modelo/peso foi adicionado ao repositório Git nesta rodada. Nenhum pacote Python pesado (Chatterbox, MuseTalk) foi instalado neste ambiente — os adapters (`lib/chatterbox-adapter.ts`, `lib/lipsync-provider.ts`) fazem uma checagem real de disponibilidade (`import` via subprocesso) e nunca simulam sucesso quando o pacote não está presente.
