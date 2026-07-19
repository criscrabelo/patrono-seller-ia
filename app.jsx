/* ============ Login + App Router ============ */
const TITLES = {
  dashboard: ['Dashboard', 'Visão geral das suas metas e operação'],
  metas: ['Painel de Metas', 'Metas por equipe, rankings e desempenho'],
  radar: ['Radar de Tendências', 'Inspiração viral — sem copiar ninguém'],
  gerar: ['Transformador IA', 'Tendência → conteúdo 100% próprio'],
  conteudos: ['Banco de Conteúdos', 'Todos os criativos da operação'],
  aprovacao: ['Aprovar Agora', 'Você só decide o que importa'],
  calendario: ['Calendário Editorial', '6 a 10 vídeos por dia, no automático'],
  produtos: ['Produtos Afiliados', 'Seu catálogo de achadinhos'],
  biblioteca: ['Vídeos Autorizados', 'Acervo seguro — só o que pode postar'],
  videoseller: ['Patrono Video Seller', 'A IA monta o vídeo do roteiro ao render'],
  series: ['Séries Fixas', 'Linhas editoriais recorrentes'],
  lucro: ['Lucro e Escala', 'Quanto você lucra e o que escalar'],
  relatorios: ['Relatórios', 'O que está dando resultado'],
  lucro: ['Painel de Lucro e Escala', 'Quanto você lucra e o que vale escalar'],
  decisao: ['Motor de Decisão', 'Campeão, variação ou pausa — automático'],
  links: ['Links Dinâmicos', 'Rastreamento de cliques e vendas'],
  publicacao: ['Publicação', 'Conecte suas redes e publique no automático ou manual'],
  contas: ['Contas e Nichos', 'Várias contas, cada uma com seus nichos · alterne a conta de trabalho'],
  usuarios: ['Usuários e permissões', 'Administradores e operadores'],
  demo: ['Como Funciona', 'Demonstração do fluxo completo da plataforma'],
  loja: ['Loja de Módulos', 'Contrate só o que precisar · módulos e combos'],
  admin_saas: ['Módulos e Receita', 'Painel da dona — vendas, uso e churn por módulo'],
  integracoes: ['Integrações', 'Publicação e plataformas de afiliados'],
  monetizacao: ['Monetização', 'Receita por plataforma e produto'],
  whatsapp: ['WhatsApp em Massa', 'Disparo de achadinhos'],
  imagens: ['Imagens e Criativos', 'Capas, carrosséis, banners e thumbnails — com autorização'],
  fornecedores: ['Fornecedores', 'Quem fornece produtos e criativos · contratos e termos'],
  creators: ['Creators e UGC', 'Creators contratados, entregas e cessão de uso'],
  compliance: ['Compliance Jurídico', 'Autorizações, termos, logs e bloqueios — risco sob controle'],
};

const SCREENS = {
  dashboard: 'Dashboard', radar: 'Radar', gerar: 'Gerar', conteudos: 'Conteudos',
  aprovacao: 'Aprovacao', calendario: 'Calendario', produtos: 'Produtos',
  biblioteca: 'Biblioteca', series: 'Series', relatorios: 'Relatorios',
  decisao: 'Decisao', integracoes: 'Integracoes', monetizacao: 'Monetizacao', whatsapp: 'WhatsApp',
  videoseller: 'VideoSeller', links: 'Links', publicacao: 'Publicacao', usuarios: 'Usuarios', lucro: 'Lucro', metas: 'Metas', demo: 'ComoFunciona', loja: 'Loja', admin_saas: 'AdminSaas', contas: 'Contas',
  imagens: 'Imagens', fornecedores: 'Fornecedores', creators: 'Creators', compliance: 'Compliance',
};

const Login = ({ onEnter }) => {
  const [mode, setMode] = useState('login');
  return (
  <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
    {/* brand panel */}
    <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48,
      background: 'radial-gradient(700px 500px at 20% 10%, var(--violet-soft), transparent 55%), radial-gradient(600px 400px at 90% 90%, var(--gold-soft), transparent 55%), linear-gradient(160deg, oklch(0.2 0.03 290), oklch(0.14 0.016 285))' }}>
      <div className="row" style={{ gap: 12 }}>
        <div className="brand-mark" style={{ width: 44, height: 44 }}><BrandMark /></div>
        <div><div className="brand-name" style={{ fontSize: 18 }}>Patrono Seller</div><div className="brand-sub">IA</div></div>
      </div>
      <div>
        <div className="badge violet" style={{ marginBottom: 20 }}><Icon name="rocket" size={12} />Fábrica de conteúdo próprio</div>
        <h1 style={{ fontSize: 42, lineHeight: 1.08, letterSpacing: '-0.03em', maxWidth: 460 }}>
          Cresça nas <span style={{ background: 'linear-gradient(100deg, var(--gold), var(--gold-2))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Redes Sociais</span>, no automático.
        </h1>
        <p className="muted" style={{ fontSize: 15, marginTop: 16, maxWidth: 420 }}>
          Tendências viram roteiros próprios; vídeos e carrosséis autorizados entram na fila e a IA posta de 6 a 10 vezes por dia. Você só aprova o que importa.
        </p>
      </div>
      <div className="dim" style={{ fontSize: 12 }}>Grupo Patrono · 2026</div>
    </div>
    {/* form */}
    <div style={{ display: 'grid', placeItems: 'center', padding: 32, background: 'var(--bg)' }}>
      {mode === 'login' ? (
      <div key="login-form" style={{ width: '100%', maxWidth: 360 }}>
        <h2 style={{ fontSize: 24 }}>Entrar na plataforma</h2>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 4, marginBottom: 26 }}>Seu assistente de vendas inteligente</p>
        <label className="label">Email</label>
        <input className="input" defaultValue="cris@grupopatrono.com.br" />
        <label className="label" style={{ marginTop: 16 }}>Senha</label>
        <input className="input" type="password" defaultValue="123456" />
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 24, padding: '12px' }} onClick={onEnter}>Entrar<Icon name="arrow" size={16} /></button>
        <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 18 }}>
          <span className="dim" style={{ fontSize: 12.5 }}>Não tem acesso?</span>
          <a style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setMode('register')}>Solicitar cadastro</a>
        </div>
      </div>
      ) : (
      <div key="register-form" style={{ width: '100%', maxWidth: 360 }}>
        <h2 style={{ fontSize: 24 }}>Solicitar cadastro</h2>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 4, marginBottom: 26 }}>Sua conta passa por aprovação do administrador</p>
        <label className="label">Nome completo</label>
        <input className="input" placeholder="Seu nome" />
        <label className="label" style={{ marginTop: 16 }}>Email</label>
        <input className="input" placeholder="voce@email.com" />
        <label className="label" style={{ marginTop: 16 }}>Senha</label>
        <input className="input" type="password" placeholder="••••••••" />
        <div className="row" style={{ gap: 8, marginTop: 14, padding: '10px 12px', borderRadius: 11, background: 'var(--amber-soft)', border: '1px solid oklch(0.80 0.15 70 / 0.25)' }}>
          <Icon name="clock" size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--amber)' }}>Após enviar, aguarde a liberação no painel de aprovações.</span>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, padding: '12px' }} onClick={onEnter}>Enviar solicitação<Icon name="arrow" size={16} /></button>
        <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 18 }}>
          <span className="dim" style={{ fontSize: 12.5 }}>Já tem conta?</span>
          <a style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setMode('login')}>Entrar</a>
        </div>
      </div>
      )}
    </div>
  </div>
  );
};

function App() {
  const [logged, setLogged] = useState(false);
  const [active, setActive] = useState('dashboard');
  const [acctId, setAcctId] = useState((DATA.contas.find(c => c.atual) || DATA.contas[0]).id);
  const [role, setRole] = useState('admin'); // admin | operador
  const [, setTick] = useState(0);
  React.useEffect(() => { window.__rerender = () => setTick(t => t + 1); }, []);
  const go = (id) => { setActive(id); document.querySelector('.content')?.scrollTo(0, 0); };
  const switchAcct = (id) => { setAcctId(id); go('dashboard'); };

  if (!logged) return <Login onEnter={() => setLogged(true)} />;

  const acct = DATA.contas.find(c => c.id === acctId) || DATA.contas[0];

  // telas que o operador NÃO acessa (Compliance fica liberado em modo somente-leitura)
  const adminOnly = ['lucro','decisao','aprovacao','contas','links','publicacao','integracoes','monetizacao','whatsapp','usuarios','loja','admin_saas','demo','fornecedores'];
  const activeSafe = (role === 'operador' && adminOnly.includes(active)) ? 'dashboard' : active;

  const Screen = window[SCREENS[activeSafe]] || window.Dashboard;
  const [title, sub] = TITLES[activeSafe] || ['', ''];
  // módulo da Loja vinculado a esta tela, se ainda não contratado → prévia/paywall
  const lockedMod = DATA.saas.modulos.find(m => m.tela === activeSafe && !m.ativo) || null;
  const extraProps = activeSafe === 'contas' ? { acct, onSwitch: switchAcct } : {};

  return (
    <div className="app">
      <Sidebar active={activeSafe} go={go} acct={acct} accts={DATA.contas} onSwitch={switchAcct} role={role} />
      <div className="main">
        <div className="topbar">
          <div><h1>{title}</h1><div className="topbar-sub">{sub}</div></div>
          <div className="topbar-spacer" />
          {/* Seletor de visão (demo) */}
          <div style={{ display: 'inline-flex', padding: 3, borderRadius: 99, background: 'oklch(0 0 0 / 0.3)', border: '1px solid var(--border)' }}>
            {[['admin','Admin'],['operador','Operador']].map(([k,l]) => (
              <button key={k} onClick={() => { setRole(k); go('dashboard'); }} style={{ padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', background: role === k ? (k === 'admin' ? 'var(--gold)' : 'var(--violet)') : 'transparent', color: role === k ? (k === 'admin' ? 'oklch(0.2 0.02 70)' : 'white') : 'var(--text-muted)' }}>{l}</button>
            ))}
          </div>
          <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }}>
            <Icon name="bell" size={16} />
            <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: 99, background: 'var(--amber)', border: '2px solid var(--surface)' }} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => go('gerar')}><Icon name="sparkles" size={14} />Gerar</button>
        </div>
        <div className="content">
          <Screen key={activeSafe + role + acctId} go={go} role={role} locked={lockedMod} {...extraProps} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
