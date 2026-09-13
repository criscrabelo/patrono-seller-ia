/* ============ Como Funciona — demonstração animada ============ */
const { useEffect, useRef } = React;

const FLUXO = [
  { ic:'radar',     cor:'violet', t:'1 · Radar de Tendências', d:'A IA varre o que está viralizando nas categorias de organização e casa — só como inspiração, nunca cópia.', tela:'radar' },
  { ic:'brain',     cor:'violet', t:'2 · IA analisa', d:'Gancho, dor do público, formato e por que viralizou. Avalia o risco de cópia antes de qualquer coisa.', tela:'radar' },
  { ic:'sparkles',  cor:'gold',   t:'3 · Cria versão própria', d:'Gera 5 ganchos, 5 roteiros, 5 legendas e CTAs — 100% originais, sem copiar ninguém.', tela:'gerar' },
  { ic:'shield',    cor:'green',  d:'Vincula um vídeo ou carrossel da Biblioteca de Autorizados. Só entra o que tem "pode postar: sim".', t:'4 · Criativo autorizado', tela:'biblioteca' },
  { ic:'bag',       cor:'gold',   t:'5 · Produto + link', d:'Combina o criativo com o produto afiliado certo, link rastreável e aviso de afiliado na legenda.', tela:'produtos' },
  { ic:'calendar',  cor:'blue',   t:'6 · Agenda e publica', d:'Monta a fila de 6 a 10 posts por dia. Você só é chamada para aprovar o que precisa de decisão.', tela:'calendario' },
  { ic:'dollar',    cor:'green',  t:'7 · Mede e escala', d:'Mostra lucro por plataforma e o Score de Escala. Produto campeão vira campanha automaticamente.', tela:'lucro' },
];

const ComoFunciona = ({ go }) => {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => setStep(s => (s + 1) % FLUXO.length), 2600);
    return () => clearTimeout(timer.current);
  }, [step, playing]);

  const cur = FLUXO[step];

  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(700px 240px at 50% 0%, var(--violet-soft), transparent 60%), var(--surface)', textAlign: 'center', padding: '28px 24px' }}>
        <span className="badge violet" style={{ margin: '0 auto' }}><Icon name="play" size={12} />Demonstração</span>
        <h2 style={{ fontSize: 24, marginTop: 14 }}>Como o Patrono Seller trabalha por você</h2>
        <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '8px auto 0' }}>Da tendência ao lucro, no automático — com aprovação sua nos pontos que importam e zero conteúdo copiado.</p>
      </div>

      {/* Player */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'stretch' }}>
          {/* Visual à esquerda */}
          <div style={{ position: 'relative', minHeight: 320, display: 'grid', placeItems: 'center', padding: 30, background: `radial-gradient(400px 300px at 50% 40%, var(--${cur.cor}-soft), transparent 70%)`, borderRight: '1px solid var(--border-soft)' }}>
            <div key={step} className="fade-in col" style={{ alignItems: 'center', gap: 18 }}>
              <div style={{ width: 96, height: 96, borderRadius: 26, display: 'grid', placeItems: 'center', background: `var(--${cur.cor}-soft)`, color: `var(--${cur.cor})`, border: `1px solid oklch(0.7 0.12 285 / 0.25)`, boxShadow: `0 0 40px var(--${cur.cor}-soft)` }}>
                <Icon name={cur.ic} size={44} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                {FLUXO.map((f, i) => (
                  <div key={i} onClick={() => { setStep(i); setPlaying(false); }} style={{ width: i === step ? 28 : 9, height: 9, borderRadius: 99, cursor: 'pointer', background: i === step ? `var(--${cur.cor})` : 'var(--surface-3)', transition: 'all .2s' }} />
                ))}
              </div>
            </div>
            <button className="btn btn-icon btn-ghost" onClick={() => setPlaying(p => !p)} style={{ position: 'absolute', bottom: 16, right: 16 }}>
              <Icon name={playing ? 'pause' : 'play'} size={16} />
            </button>
          </div>

          {/* Texto à direita */}
          <div style={{ padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div key={step} className="fade-in">
              <span className="dim mono" style={{ fontSize: 12 }}>PASSO {step + 1} DE {FLUXO.length}</span>
              <h3 style={{ fontSize: 22, marginTop: 8 }}>{cur.t}</h3>
              <p className="muted" style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>{cur.d}</p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={() => go(cur.tela)}>Abrir esta tela<Icon name="arrow" size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Passos como trilha */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {FLUXO.map((f, i) => (
          <div key={i} onClick={() => { setStep(i); setPlaying(false); }} className="card" style={{ padding: '14px 10px', textAlign: 'center', cursor: 'pointer', borderColor: i === step ? `oklch(0.7 0.15 285 / 0.4)` : 'var(--border-soft)', background: i === step ? `var(--${f.cor}-soft)` : undefined, transition: 'all .15s' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', margin: '0 auto 8px', background: `var(--${f.cor}-soft)`, color: `var(--${f.cor})` }}><Icon name={f.ic} size={17} /></div>
            <div style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.2 }}>{f.t.split(' · ')[1]}</div>
          </div>
        ))}
      </div>

      {/* Regras de ouro */}
      <div className="card" style={{ borderColor: 'oklch(0.80 0.16 158 / 0.25)' }}>
        <div className="card-head"><Icon name="shield" size={16} style={{ color: 'var(--green)' }} /><div className="card-title" style={{ fontSize: 14 }}>As regras de ouro da plataforma</div></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {['Sem autorização, não publica','Sem link válido, não agenda','Sem aprovação inicial, não automatiza','Sem lucro ou escala, não insiste','Produto campeão vira campanha'].map(r => (
            <div key={r} className="row" style={{ gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--green-soft)' }}>
              <Icon name="check" size={14} style={{ color: 'var(--green)', flexShrink: 0 }} /><span style={{ fontSize: 12.5, fontWeight: 500 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.ComoFunciona = ComoFunciona;
