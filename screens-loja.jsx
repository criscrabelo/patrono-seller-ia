/* ============ Loja de Módulos (cliente) ============ */
const Loja = ({ go }) => {
  const S = DATA.saas;
  const [ciclo, setCiclo] = useState('mensal'); // mensal | anual (2 meses grátis)
  const [aba, setAba] = useState('modulos');     // modulos | combos
  const fmt = (v) => v == null ? '' : 'R$ ' + v;
  const precoCiclo = (m) => m == null ? null : ciclo === 'anual' ? Math.round(m * 10) : m;

  const ativos = S.modulos.filter(m => m.ativo);
  const totalMensal = ativos.reduce((s, m) => s + (m.mensal || 0), 0) + S.planoBase.preco;

  return (
    <div className="content-inner fade-in">
      {/* Resumo da assinatura atual */}
      <div className="goal-card" style={{ padding: 22, borderRadius: 18 }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div>
            <span className="dim mono" style={{ fontSize: 12, letterSpacing: '0.04em' }}>SUA ASSINATURA · {ativos.length} módulos + Base</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, marginTop: 8 }}>R$ {totalMensal}<span className="dim" style={{ fontSize: 16, fontWeight: 500 }}>/mês</span></div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <span className="badge gray" style={{ padding: '2px 8px' }}>{S.planoBase.nome}</span>
              {ativos.map(m => <span key={m.id} className={`badge ${m.cor}`} style={{ padding: '2px 8px' }}>{m.nome}</span>)}
            </div>
          </div>
          <div className="col" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'inline-flex', padding: 3, borderRadius: 99, background: 'oklch(0 0 0 / 0.3)', border: '1px solid var(--border)' }}>
              {['mensal','anual'].map(c => (
                <button key={c} onClick={() => setCiclo(c)} style={{ padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)', background: ciclo === c ? 'var(--gold)' : 'transparent', color: ciclo === c ? 'oklch(0.2 0.02 70)' : 'var(--text-muted)' }}>{c === 'mensal' ? 'Mensal' : 'Anual'}</button>
              ))}
            </div>
            {ciclo === 'anual' && <span className="badge green" style={{ padding: '2px 8px' }}><Icon name="bolt" size={11} />2 meses grátis</span>}
          </div>
        </div>
      </div>

      <div className="row spread wrap" style={{ gap: 12 }}>
        <div className="chips">
          <div className={`chip ${aba === 'modulos' ? 'active' : ''}`} onClick={() => setAba('modulos')}>Módulos avulsos</div>
          <div className={`chip ${aba === 'combos' ? 'active' : ''}`} onClick={() => setAba('combos')}>Combos</div>
        </div>
        <span className="dim" style={{ fontSize: 12.5 }}>Pague só pelo que usar · ative ou cancele quando quiser</span>
      </div>

      {/* Módulos avulsos */}
      {aba === 'modulos' && (
        <div className="grid g3">
          {S.modulos.map(m => {
            const preco = precoCiclo(m.mensal);
            return (
              <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', borderColor: m.ativo ? `oklch(0.7 0.13 285 / 0.35)` : 'var(--border-soft)' }}>
                {m.selo && <span className={`badge ${window.seloMap[m.selo]}`} style={{ position: 'absolute', top: -10, right: 14, padding: '2px 9px' }}>{m.selo}</span>}
                <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                  <div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `var(--${m.cor}-soft)`, color: `var(--${m.cor})` }}><Icon name={m.icon} size={20} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.nome}</div>{m.ativo && <span className="badge green" style={{ padding: '1px 7px', fontSize: 10, marginTop: 2 }}><span className="dot" />Ativo</span>}</div>
                </div>
                <p className="muted" style={{ fontSize: 12.5, minHeight: 34 }}>{m.desc}</p>
                <div className="col" style={{ gap: 6, margin: '12px 0', flex: 1 }}>
                  {m.recursos.slice(0, 4).map(r => <div key={r} className="row" style={{ gap: 7 }}><Icon name="check" size={12} style={{ color: `var(--${m.cor})`, flexShrink: 0 }} /><span className="muted" style={{ fontSize: 12 }}>{r}</span></div>)}
                </div>
                {/* créditos se houver e ativo */}
                {m.ativo && m.creditos && m.creditos.usado != null && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="row spread" style={{ marginBottom: 5 }}><span className="dim" style={{ fontSize: 11 }}>{m.creditos.label}</span><span className="mono" style={{ fontSize: 11 }}>{m.creditos.usado}/{m.creditos.total}</span></div>
                    <div className="bar violet" style={{ height: 6 }}><i style={{ width: (m.creditos.usado / m.creditos.total * 100) + '%' }} /></div>
                  </div>
                )}
                <div className="divider" style={{ margin: '4px 0 12px' }} />
                <div className="row spread">
                  <div><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>{m.precoLabel || fmt(preco)}</span>{preco != null && <span className="dim" style={{ fontSize: 12 }}>/{ciclo === 'anual' ? 'ano' : 'mês'}</span>}</div>
                  {m.ativo
                    ? <button className="btn btn-ghost btn-sm" onClick={() => m.tela && go(m.tela)}>Abrir<Icon name="arrow" size={13} /></button>
                    : m.precoLabel
                      ? <button className="btn btn-ghost btn-sm"><Icon name="message" size={13} />Falar</button>
                      : <div className="row" style={{ gap: 7 }}>
                          {m.tela && <button className="btn btn-ghost btn-sm" onClick={() => go(m.tela)}><Icon name="eye" size={13} />Prévia</button>}
                          <button className="btn btn-primary btn-sm" onClick={() => { m.ativo = true; window.__rerender(); }}><Icon name="plus" size={13} />Ativar</button>
                        </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Combos */}
      {aba === 'combos' && (
        <div className="grid g3">
          {S.combos.map(c => {
            const preco = precoCiclo(c.preco);
            return (
              <div key={c.id} className="card" style={{ position: 'relative', borderColor: c.selo ? `oklch(0.84 0.155 86 / 0.4)` : 'var(--border-soft)', background: c.selo ? 'radial-gradient(400px 160px at 50% 0%, var(--gold-soft), transparent 65%), var(--surface)' : undefined }}>
                {c.selo && <span className={`badge ${window.seloMap[c.selo]}`} style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', padding: '2px 10px' }}>{c.selo}</span>}
                <div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `var(--${c.cor}-soft)`, color: `var(--${c.cor})`, margin: '4px 0 12px' }}><Icon name="layers" size={20} /></div>
                <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>Combo {c.nome}</div>
                <div className="row" style={{ alignItems: 'flex-end', gap: 6, marginTop: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28 }}>{fmt(preco)}</span>
                  <span className="dim" style={{ fontSize: 13, marginBottom: 4 }}>/{ciclo === 'anual' ? 'ano' : 'mês'}</span>
                </div>
                <span className="badge green" style={{ padding: '2px 8px', marginTop: 8 }}><Icon name="dollar" size={11} />Economia de R$ {c.economia}/mês</span>
                <div className="col" style={{ gap: 7, margin: '14px 0' }}>
                  {c.mods.map(r => <div key={r} className="row" style={{ gap: 7 }}><Icon name="check" size={13} style={{ color: `var(--${c.cor})`, flexShrink: 0 }} /><span style={{ fontSize: 12.5 }}>{r}</span></div>)}
                </div>
                <button className={`btn ${c.selo ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '100%', marginTop: 'auto' }}><Icon name="rocket" size={14} />Assinar combo</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="dim" style={{ fontSize: 12, textAlign: 'center' }}>Upgrade, downgrade ou cancelamento a qualquer momento · créditos extras de IA, usuários e marcas adicionais sob demanda</div>
    </div>
  );
};

window.Loja = Loja;
