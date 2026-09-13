/* ============ Radar de Tendências + Analisador ============ */
const cats = ['Todas','Cozinha','Geladeira','Banheiro','Guarda-roupa','Lavanderia','Gavetas'];

const Radar = ({ go }) => {
  const [cat, setCat] = useState('Todas');
  const [sel, setSel] = useState(DATA.trends[0]);
  const list = cat === 'Todas' ? DATA.trends : DATA.trends.filter(t => t.cat === cat);
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 100% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="radar" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Radar de Tendências Virais</h2>
              <p className="muted" style={{ fontSize: 13 }}>Apenas inspiração estratégica · nada é copiado ou repostado automaticamente</p>
            </div>
          </div>
          <button className="btn btn-violet"><Icon name="refresh" size={15} />Varrer agora</button>
        </div>
        <div className="chips" style={{ marginTop: 16 }}>
          {cats.map(c => <div key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</div>)}
        </div>
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'start' }}>
        {/* Lista */}
        <div className="col" style={{ gap: 12 }}>
          {list.map(t => (
            <div key={t.id} className="card" onClick={() => setSel(t)}
              style={{ cursor: 'pointer', padding: 16, borderColor: sel.id === t.id ? 'oklch(0.68 0.195 295 / 0.45)' : 'var(--border-soft)', boxShadow: sel.id === t.id ? '0 0 0 3px var(--violet-soft)' : 'none' }}>
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 7, marginBottom: 6 }}>
                    <span className="badge gray" style={{ padding: '2px 7px' }}>{t.cat}</span>
                    <span className="dim" style={{ fontSize: 11.5 }}>{t.plataforma} · {t.views} views</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.tema}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t.gancho}</div>
                </div>
                <div className="col" style={{ alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: t.score >= 90 ? 'var(--gold)' : 'var(--text)' }}>{t.score}</div>
                  <span className="dim" style={{ fontSize: 9.5, letterSpacing: '0.05em' }}>SCORE</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Analisador */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="row spread" style={{ marginBottom: 14 }}>
            <div className="card-title">Analisador de Tendência</div>
            <span className={`badge ${window.riscoMap[sel.risco].cls}`}><span className="dot" />{window.riscoMap[sel.risco].label}</span>
          </div>
          <div className="row" style={{ gap: 14, marginBottom: 16 }}>
            <PhonePreview w={108} label={`referência\n(somente análise)`} badge={<span className="badge violet" style={{ padding: '2px 7px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>{sel.views}</span>} />
            <div className="col" style={{ gap: 9, flex: 1 }}>
              {[['Gancho', sel.gancho],['Dor do público', sel.dor],['Formato', sel.formato],['Duração', sel.dur],['Tipo de CTA', sel.cta]].map(([k,v]) => (
                <div key={k} className="col" style={{ gap: 1 }}>
                  <span className="dim" style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 12, borderRadius: 11, background: 'var(--violet-soft)', border: '1px solid oklch(0.68 0.195 295 / 0.25)' }}>
            <div className="row" style={{ gap: 7, marginBottom: 5 }}><Icon name="brain" size={14} style={{ color: 'var(--violet)' }} /><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)' }}>Por que viralizou (IA)</span></div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Gancho de dor universal nos 2s + transformação visual satisfatória + produto demonstrável e barato. Alta chance de venda por impulso.</p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => go('gerar')}>
            <Icon name="sparkles" size={15} />Transformar em conteúdo próprio
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============ Transformador IA (Gerar Conteúdo) ============ */
const Gerar = ({ go }) => {
  const [done, setDone] = useState(true);
  return (
    <div className="content-inner fade-in">
      <div className="grid g2" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="row" style={{ gap: 10, marginBottom: 16 }}>
            <div className="ico" style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)' }}><Icon name="sparkles" /></div>
            <div className="card-title">Transformador IA</div>
          </div>
          <label className="label">Tendência base</label>
          <div className="select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Gaveta da cozinha <Icon name="chevD" size={15} /></div>
          <label className="label" style={{ marginTop: 14 }}>Produto sugerido</label>
          <div className="select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Talheres Expansível <Icon name="chevD" size={15} /></div>
          <label className="label" style={{ marginTop: 14 }}>Série</label>
          <div className="chips">
            {['Achadinhos','Antes/depois','Bobos que resolvem'].map((s,i) => <div key={s} className={`chip ${i===0?'active':''}`}>{s}</div>)}
          </div>
          <label className="label" style={{ marginTop: 14 }}>Duração</label>
          <div className="chips">{['15s','25s','35s'].map((d,i) => <div key={d} className={`chip ${i===0?'active':''}`}>{d}</div>)}</div>
          <div className="divider" style={{ margin: '16px 0' }} />
          <div className="col" style={{ gap: 6, fontSize: 12.5 }} >
            {['5 ganchos originais','5 roteiros próprios','5 legendas A/B','5 CTAs de seguir','5 CTAs de compra','3 produtos compatíveis'].map(x => (
              <div key={x} className="row" style={{ gap: 8 }}><Icon name="check" size={13} style={{ color: 'var(--green)' }} /><span className="muted">{x}</span></div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setDone(true)}><Icon name="bolt" size={15} />Gerar versão própria</button>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="row spread">
            <SectionTitle>5 roteiros próprios gerados</SectionTitle>
            <span className="badge violet"><Icon name="shield" size={12} />100% original · sem cópia</span>
          </div>
          {DATA.roteiros.map((r, i) => (
            <div key={i} className="card">
              <div className="row spread" style={{ marginBottom: 12 }}>
                <div className="row" style={{ gap: 9 }}>
                  <span className="badge gold" style={{ padding: '3px 8px' }}>#{i+1}</span>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{r.titulo}</span>
                </div>
                <span className="badge gray">{r.dur}</span>
              </div>
              <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="col" style={{ gap: 10 }}>
                  {[['Gancho (2s)', r.gancho],['Problema', r.problema],['Solução', r.solucao]].map(([k,v]) => (
                    <div key={k}><span className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span><div style={{ fontSize: 13, marginTop: 2 }}>{v}</div></div>
                  ))}
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <div><span className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Texto na tela</span><div style={{ fontSize: 13, marginTop: 2, fontWeight: 600, color: 'var(--gold)' }}>{r.tela}</div></div>
                  <div><span className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTA</span><div style={{ fontSize: 13, marginTop: 2 }}>{r.cta}</div></div>
                  <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
                    <button className="btn btn-ghost btn-sm"><Icon name="copy" size={13} />Copiar</button>
                    <button className="btn btn-violet btn-sm" onClick={() => go('biblioteca')}><Icon name="video" size={13} />Vincular vídeo</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.Radar = Radar;
window.Gerar = Gerar;
