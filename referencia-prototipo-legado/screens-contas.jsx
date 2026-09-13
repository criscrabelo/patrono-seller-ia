/* ============ Contas e Nichos ============ */
const Contas = ({ acct, onSwitch }) => {
  const [sel, setSel] = useState(acct ? acct.id : DATA.contas[0].id);
  const conta = DATA.contas.find(c => c.id === sel) || DATA.contas[0];
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 100% 0%, var(--gold-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)' }}><Icon name="users" size={22} /></div>
            <div><h2 style={{ fontSize: 18 }}>Contas e Nichos</h2><p className="muted" style={{ fontSize: 13 }}>Conecte várias contas e escolha os nichos de cada uma · alterne a conta de trabalho quando quiser</p></div>
          </div>
          <button className="btn btn-primary"><Icon name="plus" size={15} />Conectar nova conta</button>
        </div>
      </div>

      <div className="grid g4">
        <StatCard icon="users" color="gold" value={DATA.contas.length} label="Contas conectadas" />
        <StatCard icon="video" color="violet" value={DATA.contas.reduce((s,c)=>s+c.redes.length,0)} label="Redes vinculadas" />
        <StatCard icon="grid" color="blue" value={new Set(DATA.contas.flatMap(c=>c.nichos)).size} label="Nichos em uso" />
        <StatCard icon="trend" color="green" value={DATA.contas.reduce((s,c)=>s+c.seguidores,0).toLocaleString('pt-BR')} label="Seguidores somados" />
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        {/* lista de contas */}
        <div className="col" style={{ gap: 12 }}>
          {DATA.contas.map(c => (
            <div key={c.id} className="card" onClick={() => setSel(c.id)} style={{ cursor: 'pointer', padding: 16, borderColor: sel === c.id ? `oklch(0.7 0.13 285 / 0.4)` : 'var(--border-soft)', boxShadow: sel === c.id ? '0 0 0 3px var(--violet-soft)' : 'none' }}>
              <div className="row spread">
                <div className="row" style={{ gap: 11, minWidth: 0 }}>
                  <div className="avatar" style={{ width: 38, height: 38, fontSize: 15, background: `linear-gradient(140deg, var(--${c.cor}), var(--violet-2))`, color: c.cor === 'gold' ? 'oklch(0.2 0.02 70)' : 'white', flexShrink: 0 }}>{c.nome.replace('Cliente · ','')[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>{c.atual && <span className="badge green" style={{ padding: '0 6px', fontSize: 9.5 }}>ativa</span>}{c.cliente && <span className="badge violet" style={{ padding: '0 6px', fontSize: 9.5 }}>cliente</span>}</div>
                    <div className="dim" style={{ fontSize: 12 }}>{c.handle} · {c.seguidores.toLocaleString('pt-BR')} seguidores</div>
                  </div>
                </div>
                {onSwitch && !c.atual && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onSwitch(c.id); }}>Trabalhar</button>}
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
                {c.redes.map(r => <span key={r.p} className={`badge ${window.redeStatusMap[r.st].cls}`} style={{ padding: '2px 8px' }}><span className="dot" />{r.p}</span>)}
                <span className="badge gray" style={{ padding: '2px 8px' }}>{c.plano}</span>
              </div>
              <div className="row wrap" style={{ gap: 5, marginTop: 9 }}>
                {c.nichos.map(n => <span key={n} className="chip" style={{ padding: '3px 9px', fontSize: 11, cursor: 'default' }}>{n}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* editor de nichos da conta selecionada */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="row" style={{ gap: 10, marginBottom: 4 }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: `linear-gradient(140deg, var(--${conta.cor}), var(--violet-2))`, color: conta.cor === 'gold' ? 'oklch(0.2 0.02 70)' : 'white' }}>{conta.nome.replace('Cliente · ','')[0]}</div>
            <div><div className="card-title" style={{ fontSize: 14 }}>{conta.nome}</div><div className="dim" style={{ fontSize: 11.5 }}>{conta.handle}</div></div>
          </div>
          <label className="label" style={{ marginTop: 14 }}>Nichos desta conta</label>
          <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>O Radar e a IA usam os nichos escolhidos para buscar tendências e gerar conteúdo só do que importa para esta conta.</p>
          <div className="row wrap" style={{ gap: 7 }}>
            {DATA.nichos.map(n => {
              const on = conta.nichos.includes(n);
              return <span key={n} className={`chip ${on ? 'active' : ''}`} style={{ padding: '6px 12px' }}>{on && <Icon name="check" size={11} style={{ marginRight: 4 }} />}{n}</span>;
            })}
          </div>
          <div className="divider" style={{ margin: '16px 0' }} />
          <label className="label">Redes desta conta</label>
          <div className="col" style={{ gap: 8 }}>
            {conta.redes.map(r => (
              <div key={r.p} className="row spread" style={{ padding: '9px 11px', borderRadius: 10, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
                <div className="row" style={{ gap: 8 }}><Icon name="video" size={14} style={{ color: 'var(--text-muted)' }} /><span style={{ fontSize: 13, fontWeight: 500 }}>{r.p}</span></div>
                {r.st === 'conectada' ? <span className="badge green" style={{ padding: '1px 8px' }}><Icon name="check" size={11} />Conectada</span> : <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }}>Conectar</button>}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 2 }}><Icon name="plus" size={13} />Adicionar rede</button>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}><Icon name="check" size={15} />Salvar nichos e redes</button>
        </div>
      </div>
    </div>
  );
};

window.Contas = Contas;
