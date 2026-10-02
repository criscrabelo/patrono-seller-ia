import type { Metadata } from 'next'
import Link from 'next/link'
import { dadosInstitucionais, RAZAO_SOCIAL, NOME_DO_PRODUTO, VERSAO_DOS_TEXTOS } from '@/lib/institucional'

export const metadata: Metadata = {
  title: `Política de Privacidade — ${NOME_DO_PRODUTO} | ${RAZAO_SOCIAL}`,
}

/**
 * Versão final pré-publicação (02/10/2026), aguardando aprovação da titular.
 *
 * Cada afirmação descreve o que o código e a infraestrutura fazem hoje. A
 * evidência de cada uma está no relatório da rodada. O que não pôde ser
 * comprovado foi redigido de forma geral, sem inventar país, mecanismo ou
 * prazo. Ao mudar o que o sistema faz, este texto muda junto — e o teste
 * `tests/rodada50-institucional.test.ts` confere as contradições conhecidas.
 */
export default function PaginaPrivacidade() {
  const e = dadosInstitucionais()
  const h2 = 'text-xl font-semibold text-accent'
  const h3 = 'font-semibold text-white'
  const lista = 'list-disc pl-6 space-y-1 text-white/80'
  const p = 'text-white/80'

  return (
    <article className="space-y-8 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        <p className="text-white/60 text-sm">Versão de {VERSAO_DOS_TEXTOS}</p>
        <p className={p}>
          Esta política explica como a <strong>{e.razaoSocial}</strong>
          {e.cnpj ? <>, inscrita no CNPJ {e.cnpj},</> : null} controladora dos dados pessoais tratados no{' '}
          <strong>{e.produto}</strong>, coleta, usa, armazena, compartilha e protege dados pessoais, nos termos
          da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
        </p>
      </header>

      <section className="space-y-3">
        <h2 className={h2}>1. Dados que tratamos</h2>
        <ul className={lista}>
          <li><strong>Conta:</strong> nome, e-mail e senha. A senha é armazenada apenas como hash (bcrypt), nunca em texto.</li>
          <li><strong>Dados do negócio:</strong> produtos, conteúdos, links de divulgação, programas de afiliados, vendas e comissões que a usuária cadastra ou importa.</li>
          <li><strong>Integrações:</strong> identificadores da conta conectada e as credenciais e tokens de acesso concedidos pela usuária nas plataformas conectadas. Ficam somente no servidor e nunca são enviados ao navegador.</li>
          <li><strong>Cliques em links rastreados:</strong> o link acessado, a plataforma e o endereço de origem informado pelo navegador (referer). O {e.produto} não grava em seu banco de dados o endereço IP de quem clica.</li>
          <li><strong>Mídia enviada:</strong> imagens e vídeos enviados pela usuária, com a declaração de origem e de direito de uso de cada arquivo.</li>
          <li><strong>Imagem e voz da própria titular (recurso opcional de avatar):</strong> fotos, vídeo de referência e áudio de referência de voz, tratados somente com o consentimento descrito na seção 3.</li>
          <li><strong>Números de telefone de terceiros (recurso opcional de envio por WhatsApp):</strong> números que a usuária insere para enviar mensagens. São guardados no navegador da própria usuária (seção 7) e enviados ao provedor de mensagens somente no momento do envio que ela comandar. Em relação a esses contatos, cabe à usuária ter base legal para contatá-los.</li>
          <li><strong>Registro de auditoria:</strong> ações relevantes na conta (por exemplo, integração conectada, revogação de consentimento, catálogo sincronizado), sem senhas nem tokens. A concessão e a revogação de cada consentimento também ficam registradas, com data.</li>
        </ul>
        <p className={p}>
          Os provedores de infraestrutura (seção 5) podem registrar, em seus próprios registros técnicos,
          metadados das requisições, como endereço IP e navegador, conforme os termos e as políticas de cada um.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>2. Para que usamos</h2>
        <ul className={lista}>
          <li>Prestar o serviço contratado: organizar produtos, preparar e publicar conteúdo, rastrear cliques, vendas e comissões.</li>
          <li>Executar as integrações que a usuária conectar e autorizar.</li>
          <li>Proteger a conta, prevenir fraudes e cumprir obrigações legais.</li>
          <li>Enviar mensagens operacionais, como a recuperação de senha.</li>
        </ul>
        <p className={p}>Não vendemos dados pessoais.</p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>3. Bases legais</h2>
        <ul className={lista}>
          <li><strong>Execução de contrato</strong> (art. 7º, V): dados de conta, do negócio, de integrações e de cliques, necessários para prestar o serviço.</li>
          <li><strong>Cumprimento de obrigação legal ou regulatória</strong> (art. 7º, II): manutenção dos registros exigidos por lei.</li>
          <li><strong>Exercício regular de direitos</strong> (art. 7º, VI): manutenção de registros de auditoria e de consentimento.</li>
          <li><strong>Legítimo interesse</strong> (art. 7º, IX): segurança da conta e prevenção a fraudes.</li>
          <li><strong>Consentimento</strong> (art. 7º, I): imagem e voz da titular no recurso de avatar. O recurso só funciona com esse consentimento, que é específico por finalidade, registrado e revogável a qualquer momento.</li>
        </ul>
        <p className={p}>
          Imagem e voz são tratadas como dados pessoais. O {e.produto} <strong>não realiza identificação nem
          verificação biométrica</strong> da titular: não há reconhecimento facial, nem extração de características
          biométricas para identificar uma pessoa. A voz de referência é usada para sintetizar a narração, não para
          identificar quem fala. Se algum recurso futuro tratar dado biométrico, esta política será atualizada e o
          tratamento observará o art. 11 da LGPD antes de começar.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>4. Inteligência artificial e automações</h2>
        <p className={p}>
          O {e.produto} usa automações e pode usar sistemas de inteligência artificial para apoiar tarefas como
          análise e priorização de oportunidades de produtos, preparação de legendas e roteiros, classificação de
          conteúdo (por exemplo, identificar alegações sem comprovação) e otimização de rotinas.
        </p>
        <ul className={lista}>
          <li>O uso de automação ou de IA não autoriza o tratamento de dados para finalidade incompatível com as descritas nesta política.</li>
          <li><strong>IA de terceiros:</strong> serviços externos de IA só recebem dados quando a funcionalidade correspondente estiver habilitada e somente o que for tecnicamente necessário para a tarefa. Hoje esses serviços ficam desligados por padrão, e a geração de conteúdo usa um caminho próprio, sem IA de terceiros.</li>
          <li><strong>Voz sintetizada:</strong> quando a titular ativa o recurso de avatar, a síntese de voz é executada em um computador de processamento indicado por ela, e não em um serviço de IA de terceiros.</li>
          <li><strong>Decisões e revisão humana:</strong> as recomendações automáticas do {e.produto} não publicam nada sozinhas. A publicação passa por verificações e pela autorização da usuária. Quando houver decisão tomada unicamente com base em tratamento automatizado que afete interesses da titular, ela poderá solicitar a revisão (art. 20 da LGPD) pelo canal da seção 11.</li>
          <li>Mídia e conteúdo da usuária <strong>não se tornam propriedade</strong> da {e.razaoSocial} pelo simples processamento por automações ou IA (seção 9).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>5. Com quem compartilhamos</h2>
        <ul className={lista}>
          <li><strong>Hospedagem da aplicação</strong> (Vercel): processa todas as requisições ao serviço.</li>
          <li><strong>Banco de dados e armazenamento de arquivos</strong> (Supabase): guarda os dados da conta, do negócio e os arquivos enviados.</li>
          <li><strong>E-mail transacional</strong> (Resend): recebe o e-mail da usuária e o conteúdo da mensagem operacional, como a recuperação de senha.</li>
          <li><strong>Plataformas que a usuária conecta</strong> — hoje, por exemplo, o Instagram (Meta): recebem somente o necessário para a ação que ela autorizou, como a mídia e a legenda de uma publicação.</li>
          <li><strong>Provedor de mensagens de WhatsApp</strong> (Z-API), quando a usuária configurar e usar esse recurso: recebe os números e a mensagem que ela mandar enviar.</li>
          <li><strong>IA de terceiros</strong>, somente nas condições da seção 4.</li>
          <li>Autoridades, quando houver obrigação legal ou ordem judicial.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>6. Transferência internacional de dados</h2>
        <p className={p}>
          Parte do tratamento pode ocorrer fora do Brasil. A transferência internacional observa o art. 33 da LGPD e
          a Resolução CD/ANPD nº 19/2024.
        </p>
        <div className="space-y-2">
          <h3 className={h3}>6.1 Hospedagem da aplicação (Vercel)</h3>
          <ul className={lista}>
            <li><strong>Região de processamento configurada:</strong> Estados Unidos (região iad1, Washington, D.C.). O fornecedor declara que suas instalações principais de processamento ficam nos Estados Unidos e que ele e seus subcontratados podem processar dados em outras localidades, conforme seus termos.</li>
            <li><strong>Finalidade:</strong> executar a aplicação e responder a cada acesso.</li>
            <li><strong>Categorias de dados:</strong> todas as que trafegam numa requisição — conta, negócio, integrações, mídia enviada e os metadados técnicos da requisição.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={h3}>6.2 Banco de dados e armazenamento (Supabase)</h3>
          <ul className={lista}>
            <li><strong>Região configurada:</strong> Brasil (região sa-east-1, São Paulo). O armazenamento principal dos dados fica no Brasil.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={h3}>6.3 Demais fornecedores</h3>
          <p className={p}>
            O provedor de e-mail transacional (Resend), as plataformas que a usuária conecta (como a Meta) e, quando
            habilitados, o provedor de mensagens de WhatsApp (Z-API) e serviços de IA de terceiros podem realizar
            tratamento internacional conforme seus termos aplicáveis. As finalidades e as categorias de dados de cada
            um estão nas seções 4 e 5.
          </p>
        </div>
        <p className={p}>
          <strong>Mecanismo jurídico:</strong> quando a LGPD exigir mecanismo específico para a transferência
          internacional, a {e.razaoSocial} o validará antes da ativação ou da continuidade do uso de cada fornecedor,
          nos termos do art. 33 da LGPD e da Resolução CD/ANPD nº 19/2024. A titular pode pedir pelo canal da seção 11
          informações sobre o mecanismo adotado para cada fornecedor.
        </p>
        <p className={p}>
          <strong>Medidas de segurança</strong> na transferência: tráfego somente por conexão criptografada (HTTPS) e
          as medidas da seção 10. <strong>Direitos:</strong> os da seção 11 valem também para os dados transferidos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>7. Cookies e armazenamento no navegador</h2>
        <p className={p}>O {e.produto} usa apenas cookies estritamente necessários ao funcionamento:</p>
        <ul className={lista}>
          <li><strong>Cookie de sessão:</strong> mantém a usuária conectada. Validade de até 30 dias.</li>
          <li><strong>Cookie de proteção contra falsificação de requisição (CSRF):</strong> protege o login.</li>
          <li><strong>Cookie de retorno após o login:</strong> lembra a página que a usuária queria abrir.</li>
        </ul>
        <p className={p}>
          Todos são próprios, inacessíveis a scripts (HttpOnly) e enviados somente por conexão segura. Não usamos
          cookies de publicidade nem de análise, e não carregamos scripts de terceiros no navegador.
        </p>
        <p className={p}>
          <strong>Armazenamento local do navegador:</strong> na tela de envio por WhatsApp, os números de contato
          salvos ficam no armazenamento local do navegador da própria usuária. Eles podem ser apagados na própria
          tela ou limpando os dados do navegador.
        </p>
        <p className={p}>
          No envio de imagens e vídeos, o arquivo vai do navegador diretamente para o provedor de armazenamento
          (seção 5).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>8. Retenção e exclusão</h2>
        <p className={p}>
          Os dados são mantidos pelo tempo necessário às finalidades desta política e ao cumprimento das obrigações
          legais aplicáveis. Não há prazos fixos por categoria: o período fica limitado a essas necessidades.
        </p>
        <h3 className={h3}>Encerramento da conta</h3>
        <p className={p}>
          A titular pode solicitar o encerramento da conta e a exclusão dos dados pelo canal da seção 11. A exclusão
          é processada conforme procedimento interno e as obrigações legais aplicáveis.
        </p>
        <ul className={lista}>
          <li><strong>São excluídos:</strong> dados da conta, produtos, conteúdos, links, mídia enviada, credenciais e tokens de integração, e os arquivos de imagem e voz do recurso de avatar.</li>
          <li>
            <strong>Podem ser mantidos</strong>, pelo tempo necessário e com acesso restrito:
            <ul className="list-[circle] pl-6 space-y-1">
              <li>registros de vendas e comissões, para cumprimento de obrigação legal e prestação de contas;</li>
              <li>registros de auditoria e de consentimento (inclusive de sua revogação), para exercício regular de direitos e prevenção a fraudes.</li>
            </ul>
          </li>
          <li><strong>Revogação do consentimento de imagem e voz:</strong> o recurso de avatar é desativado na hora e deixa de gerar conteúdo. A exclusão dos arquivos de referência pode ser solicitada pelo canal da seção 11.</li>
          <li><strong>Prévias do avatar:</strong> recebem marcação de expiração de 7 dias. A exclusão dos arquivos segue o procedimento interno de retenção e pode ser solicitada a qualquer momento pelo canal da seção 11.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>9. Propriedade da mídia e do conteúdo</h2>
        <p className={p}>
          Enviar mídia ou conteúdo ao {e.produto} para processamento, armazenamento ou publicação
          <strong> não transfere a propriedade intelectual</strong> desse material à {e.razaoSocial}. A titular
          continua com os direitos que tinha sobre o que envia. O {e.produto} usa esse material somente para
          executar o serviço que ela comandar, como armazenar, preparar e publicar nas plataformas que ela conectar.
          Os <Link className="underline" href="/termos">Termos de Uso</Link> detalham essa licença.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>10. Segurança</h2>
        <ul className={lista}>
          <li>Áreas privadas acessíveis somente com autenticação; cada conta só acessa os próprios dados.</li>
          <li>Senhas armazenadas apenas como hash (bcrypt).</li>
          <li>Tráfego somente por conexão criptografada (HTTPS); cookies de sessão inacessíveis a scripts.</li>
          <li>Credenciais e tokens de integração armazenados no servidor, com acesso restrito à aplicação, e nunca enviados ao navegador.</li>
          <li>Arquivos de imagem e voz do recurso de avatar em armazenamento privado, acessíveis só por link temporário.</li>
          <li>Imagens e vídeos enviados para publicação ficam em armazenamento com endereço público, necessário para que as plataformas conectadas busquem o arquivo.</li>
          <li>Registros de auditoria sem senhas nem tokens.</li>
        </ul>
        <p className={p}>
          Nenhum sistema é totalmente imune a incidentes. Havendo incidente de segurança que possa acarretar risco ou
          dano relevante aos titulares, a comunicação à ANPD e aos titulares seguirá o art. 48 da LGPD e o
          Regulamento de Comunicação de Incidente de Segurança (Resolução CD/ANPD nº 15/2024).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>11. Direitos da titular e canal de atendimento</h2>
        <p className={p}>Nos termos dos arts. 18 e 20 da LGPD, a titular pode, a qualquer momento, solicitar:</p>
        <ul className={lista}>
          <li>confirmação da existência de tratamento;</li>
          <li>acesso aos dados;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>portabilidade dos dados a outro fornecedor, observados os segredos comercial e industrial;</li>
          <li>eliminação dos dados tratados com base no consentimento, ressalvadas as hipóteses de conservação do art. 16;</li>
          <li>informação sobre as entidades com as quais os dados são compartilhados;</li>
          <li>informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</li>
          <li>revogação do consentimento;</li>
          <li>oposição a tratamento realizado com fundamento em outra base legal, em caso de descumprimento da LGPD (art. 18, § 2º);</li>
          <li>revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses (art. 20).</li>
        </ul>
        <p className={p}>
          A titular também pode peticionar perante a Autoridade Nacional de Proteção de Dados (ANPD) (art. 18, § 1º).
        </p>
        <h3 className={h3}>Canal de Privacidade e Proteção de Dados</h3>
        <p className={p}>
          Pedidos e dúvidas sobre dados pessoais, inclusive o exercício dos direitos acima:{' '}
          <a className="underline" href={`mailto:${e.contato}`}>{e.contato}</a>.
        </p>
        <p className={p}>
          Veja também os <Link className="underline" href="/termos">Termos de Uso</Link>.
        </p>
      </section>
    </article>
  )
}
