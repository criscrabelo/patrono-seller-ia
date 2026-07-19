/* ============ Compliance Jurídico ============ */

const Compliance = ({ go, role, locked }) => {
  const C = DATA.compliance;
  const ro = role === 'operador'; // somente leitura
  const [modal, setModal] = useState(null);
  const ring = `conic-gradient(var(--amber) ${C.score * 3.6}deg, oklch(0 0 0 / 0.35) 0deg)`;
  // roteia a ação de "Resolver" do checklist
  const resolverItem = (item) => {
    if (item.includes('banco de imagens')) return go && go('fornecedores');
    if (item.includes('claims')) return setModal('claims');
    return setModal('generico');
  };
  // roteia a ação de cada bloqueio
  const resolverBloqueio = (b) => {
    if (b.acao === 'Solicitar licença') return go && go('fornecedores');
    if (b.acao === 'Substituir') return go && go('imagens');
    return setModal('reescrever');
  };
  return (
    <div className={`content-inner fade-in${ro ? ' preview-locked' : ''}`}>
      {locked && !ro && <PaywallBanner mod={locked} go={go} onActivate={() => { locked.ativo = true; window.__rerender(); }} />}
      {ro && (
        <div className="row" style={{ gap: 10, padding: '11px 16px', borderRadius: 12, background: 'var(--violet-soft)', border: '1px solid oklch(0.62 0.18 295 / 0.28)' }}>
          <Icon name="lock" size={15} style={{ color: 'var(--violet)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--violet)' }}>Modo <strong>operador</strong> · visualização somente leitura. Resolver pendências e assinar termos é ação do administrador.</span>
        </div>
      )}
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--amber-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--amber-soft)', color: 'var(--amber)' }}><Icon name="scale" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Compliance Jurídico</h2>
              <p className="muted" style={{ fontSize: 13 }}>Autorizações, termos, logs e bloqueios · nada é publicado <strong style={{ color: 'var(--amber)' }}>sem respaldo jurídico</strong></p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setModal('relatorio')}><Icon name="download" size={15} />Exportar relatório</button>
        </div>
      </div>

      {/* Score + checklist */}
      <div className="grid g2" style={{ gridTemplateColumns: '0.85fr 1.15fr', alignItems: 'start' }}>
        {/* Score hero */}
        <div className="goal-card" style={{ padding: 22 }}>
          <div className="row" style={{ gap: 18 }}>
            <div style={{ position: 'relative', width: 112, height: 112, borderRadius: 99, background: ring, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 9, borderRadius: 99, background: 'oklch(0.18 0.02 285)', display: 'grid', placeItems: 'center' }}>
                <div className="col" style={{ alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, lineHeight: 1, color: 'var(--amber)' }}>{C.score}</span>
                  <span className="dim" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>/ 100</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <span className="dim mono" style={{ fontSize: 11, letterSpacing: '0.05em' }}>ÍNDICE DE CONFORMIDADE</span>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>Operação em conformidade, com pendências pontuais</div>
              <span className="badge amber" style={{ marginTop: 10 }}><Icon name="alert" size={11} />2 itens exigem ação</span>
            </div>
          </div>
          <div className="grid g2" style={{ gap: 10, marginTop: 18 }}>
            {[['check','green', C.conformes,'Conteúdos conformes'],['ban','red', C.bloqueados,'Bloqueados'],['shield','blue', C.autorizacoes,'Autorizações vigentes'],['clock','amber', C.vencendo,'Vencendo em 30d']].map(([ic,co,v,l]) => (
              <div key={l} className="row" style={{ gap: 10, padding: '11px 12px', borderRadius: 12, background: 'oklch(0 0 0 / 0.22)', border: '1px solid var(--border-soft)' }}>
                <div className="ico" style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: `var(--${co}-soft)`, color: `var(--${co})`, flexShrink: 0 }}><Icon name={ic} size={16} /></div>
                <div className="col"><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{v}</span><span className="dim" style={{ fontSize: 10.5 }}>{l}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="card">
          <div className="card-head" style={{ marginBottom: 14 }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--amber-soft)', color: 'var(--amber)' }}><Icon name="checkCircle" size={18} /></div>
            <div><div className="card-title">Checklist jurídico</div><div className="card-desc">Verificações automáticas da conta</div></div>
          </div>
          <div className="col" style={{ gap: 2 }}>
            {C.checklist.map((c, i) => (
              <div key={i} className="row" style={{ gap: 12, padding: '11px 4px', borderBottom: i < C.checklist.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="ico" style={{ width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', background: c.ok ? 'var(--green-soft)' : 'var(--red-soft)', color: c.ok ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}><Icon name={c.ok ? 'check' : 'x'} size={14} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.item}</div>
                  <div className="dim" style={{ fontSize: 11.5 }}>{c.det}</div>
                </div>
                {!c.ok && !ro && <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => resolverItem(c.item)}>Resolver</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Documentos + Logs */}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card flush">
          <div className="row spread" style={{ padding: '16px 18px 12px' }}>
            <div className="row" style={{ gap: 10 }}><Icon name="doc" size={17} style={{ color: 'var(--text-muted)' }} /><span className="card-title">Termos e políticas</span></div>
            <button className="btn btn-ghost btn-sm"><Icon name="plus" size={13} />Novo</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Documento</th><th>Versão</th><th>Atualizado</th><th className="right">Status</th></tr></thead>
            <tbody>
              {C.documentos.map((d, i) => {
                const m = DATA.docMap[d.status];
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{d.nome}</td>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{d.versao}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{d.atualizado}</td>
                    <td className="right"><span className={`badge ${m.cls}`} style={{ padding: '2px 8px' }}>{m.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="row spread" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 10 }}><Icon name="clock" size={17} style={{ color: 'var(--text-muted)' }} /><span className="card-title">Logs de aprovação</span></div>
            <span className="badge gray" style={{ padding: '2px 8px' }}>Auditável</span>
          </div>
          <div className="col" style={{ gap: 0 }}>
            {C.logs.map((l, i) => {
              const m = DATA.logMap[l.tipo];
              return (
                <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', paddingBottom: i < C.logs.length - 1 ? 16 : 0 }}>
                  <div className="col" style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                    <div className="ico" style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `var(--${m.cls}-soft)`, color: `var(--${m.cls})`, flexShrink: 0 }}><Icon name={m.icon} size={14} /></div>
                    {i < C.logs.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border-soft)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                    <div className="row spread"><span style={{ fontSize: 13, fontWeight: 600 }}>{l.acao}</span><span className="dim" style={{ fontSize: 11 }}>{l.quando}</span></div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 1 }}><span className="mono">{l.alvo}</span></div>
                    {l.motivo && <div style={{ fontSize: 11.5, color: `var(--${m.cls})`, marginTop: 3 }}>{l.motivo}</div>}
                    <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>por {l.quem}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bloqueios ativos */}
      <div className="card flush" style={{ borderColor: 'oklch(0.70 0.19 22 / 0.3)' }}>
        <div className="row spread" style={{ padding: '16px 18px 12px' }}>
          <div className="row" style={{ gap: 10 }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--red-soft)', color: 'var(--red)' }}><Icon name="lock" size={17} /></div>
            <div><div className="card-title">Conteúdos bloqueados</div><div className="card-desc">Não vão para a fila enquanto a pendência existir</div></div>
          </div>
          <span className="badge red" style={{ padding: '3px 9px' }}>{C.bloqueios.length} ativos</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Conteúdo</th><th>Tipo</th><th>Motivo do bloqueio</th><th>Desde</th><th className="right">Ação</th></tr></thead>
          <tbody>
            {C.bloqueios.map((b, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{b.conteudo}</td>
                <td><span className="badge gray" style={{ padding: '2px 8px' }}>{b.tipo}</span></td>
                <td className="muted" style={{ fontSize: 12.5, maxWidth: 320 }}>{b.motivo}</td>
                <td className="dim" style={{ fontSize: 12 }}>{b.desde}</td>
                <td className="right">{ro
                  ? <span className="dim" style={{ fontSize: 11.5 }}>somente leitura</span>
                  : <button className="btn btn-danger btn-sm" onClick={() => resolverBloqueio(b)}>{b.acao}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reescrever legenda (claim de risco) */}
      <Modal open={modal === 'reescrever' || modal === 'claims'} onClose={() => setModal(null)} icon="pencil" iconColor="amber" w={500}
        title="Reescrever legenda" sub="Varal Retrátil · Lavanderia funcional"
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => setModal(null)}><Icon name="check" size={13} />Aprovar reescrita</button></>}>
        <div className="row" style={{ gap: 9, padding: '10px 12px', borderRadius: 11, background: 'var(--red-soft)', border: '1px solid oklch(0.70 0.19 22 / 0.25)', marginBottom: 14 }}>
          <Icon name="alert" size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--red)' }}>Promessa de resultado garantido viola a política de publicidade.</span>
        </div>
        <div className="dim" style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Original (bloqueado)</div>
        <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 10, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)', marginBottom: 14, lineHeight: 1.5 }}>"Esse varal <mark style={{ background: 'var(--red-soft)', color: 'var(--red)', padding: '0 3px', borderRadius: 3 }}>PROMETO</mark> que vai resolver sua lavanderia e <mark style={{ background: 'var(--red-soft)', color: 'var(--red)', padding: '0 3px', borderRadius: 3 }}>GARANTIDO</mark> deixar tudo seco em 1h!"</div>
        <div className="dim" style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Sugestão da IA (conforme)</div>
        <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 10, background: 'var(--green-soft)', border: '1px solid oklch(0.72 0.16 158 / 0.25)', lineHeight: 1.5 }}>"Esse varal retrátil ajuda a organizar a lavanderia e aproveita melhor o espaço pra secar as roupas. Resultados podem variar. #publi"</div>
      </Modal>

      {/* Resolver genérico */}
      <Modal open={modal === 'generico'} onClose={() => setModal(null)} icon="checkCircle" iconColor="amber"
        title="Resolver pendência" sub="Política de publicidade e claims"
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button><button className="btn btn-primary btn-sm" onClick={() => setModal(null)}><Icon name="check" size={13} />Marcar como resolvido</button></>}>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>Revise o item sinalizado e tome a ação recomendada. Ao marcar como resolvido, o índice de conformidade é recalculado e o histórico fica registrado nos logs auditáveis.</p>
      </Modal>

      {/* Exportar relatório */}
      <Modal open={modal === 'relatorio'} onClose={() => setModal(null)} icon="download" iconColor="amber"
        title="Exportar relatório jurídico" sub="Conformidade da conta · BoraComprar"
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => setModal(null)}><Icon name="download" size={13} />Gerar PDF</button></>}>
        <KV k="Índice de conformidade" v={`${C.score} / 100`} />
        <KV k="Conteúdos conformes" v={C.conformes} />
        <KV k="Bloqueios ativos" v={C.bloqueios.length} />
        <KV k="Autorizações vigentes" v={C.autorizacoes} />
        <KV k="Período" v="Últimos 90 dias" />
        <div className="row" style={{ gap: 8, marginTop: 14, padding: '9px 11px', borderRadius: 10, background: 'oklch(0 0 0 / 0.18)', border: '1px solid var(--border-soft)' }}>
          <Icon name="doc" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5 }} className="muted">Inclui termos, logs de aprovação e trilha de auditoria assinada digitalmente.</span>
        </div>
      </Modal>
    </div>
  );
};

window.Compliance = Compliance;
