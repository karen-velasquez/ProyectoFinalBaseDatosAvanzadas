import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';
import Modal from '../components/Modal.jsx';

const emptyVideo = {
  title: '', alternateTitles: '', genre: '', durationMinutes: '', year: '',
  unitCost: '', acquiredUnits: ''
};

function centsToDisplay(digits) {
  return (Number(digits || '0') / 100).toFixed(2);
}

export default function VideosPage() {
  const [query, setQuery] = useState({ q: '', genre: '', actor: '', oscar: '' });
  const [videos, setVideos] = useState([]);
  const [copiesByVideo, setCopiesByVideo] = useState({});
  const [form, setForm] = useState(emptyVideo);
  const [unitCostCents, setUnitCostCents] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [genres, setGenres] = useState([]);
  const [showGenreForm, setShowGenreForm] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  const [oscarCategories, setOscarCategories] = useState([]);
  const [oscarSelection, setOscarSelection] = useState({});
  const [oscarToAdd, setOscarToAdd] = useState('');
  const [showOscarForm, setShowOscarForm] = useState(false);
  const [newOscarCategory, setNewOscarCategory] = useState('');
  const [actorList, setActorList] = useState([]);
  const [selectedActors, setSelectedActors] = useState([]);
  const [actorToAdd, setActorToAdd] = useState('');
  const [showActorForm, setShowActorForm] = useState(false);
  const [newActor, setNewActor] = useState('');
  const [removedByVideo, setRemovedByVideo] = useState({});
  const [showRemovedFor, setShowRemovedFor] = useState(null);
  const [removalTarget, setRemovalTarget] = useState(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removalDate, setRemovalDate] = useState('');

  async function loadGenres() {
    try { setGenres(await api.listGeneros()); } catch { /* ignore */ }
  }

  async function loadOscarCategories() {
    try { setOscarCategories(await api.listParametros('categoria_oscar')); } catch { /* ignore */ }
  }

  async function loadActors() {
    try { setActorList(await api.listParametros('actor')); } catch { /* ignore */ }
  }

  useEffect(() => { loadGenres(); loadOscarCategories(); loadActors(); }, []);

  async function createGenre(e) {
    e.preventDefault();
    if (!newGenre.trim()) return;
    setError('');
    try {
      const genero = await api.createGenero({ valor: newGenre.trim(), descripcion: newGenre.trim() });
      await loadGenres();
      setForm((f) => ({ ...f, genre: genero.valor }));
      setNewGenre('');
      setShowGenreForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createOscarCategory(e) {
    e.preventDefault();
    if (!newOscarCategory.trim()) return;
    setError('');
    try {
      await api.createParametro({ tipo: 'categoria_oscar', valor: newOscarCategory.trim(), descripcion: newOscarCategory.trim() });
      await loadOscarCategories();
      setNewOscarCategory('');
      setShowOscarForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  function addOscarCategory() {
    if (!oscarToAdd || oscarSelection[oscarToAdd]) return;
    setOscarSelection((prev) => ({ ...prev, [oscarToAdd]: { won: false } }));
    setOscarToAdd('');
  }

  function removeOscarCategory(categoria) {
    setOscarSelection((prev) => { const next = { ...prev }; delete next[categoria]; return next; });
  }

  function toggleOscarWon(categoria) {
    setOscarSelection((prev) => ({ ...prev, [categoria]: { won: !prev[categoria].won } }));
  }

  async function createActor(e) {
    e.preventDefault();
    if (!newActor.trim()) return;
    setError('');
    try {
      const parametro = await api.createParametro({ tipo: 'actor', valor: newActor.trim(), descripcion: newActor.trim() });
      await loadActors();
      setSelectedActors((prev) => [...prev, parametro.valor]);
      setNewActor('');
      setShowActorForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  function addActor() {
    if (!actorToAdd || selectedActors.includes(actorToAdd)) return;
    setSelectedActors((prev) => [...prev, actorToAdd]);
    setActorToAdd('');
  }

  function removeActor(nombre) {
    setSelectedActors((prev) => prev.filter((a) => a !== nombre));
  }

  async function search(e) {
    e?.preventDefault();
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
      setVideos(await api.searchVideos(params));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { search(); }, []);

  async function loadCopies(videoId) {
    try {
      const copies = await api.availableCopies(videoId);
      setCopiesByVideo((prev) => ({ ...prev, [videoId]: copies }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function createVideo(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!form.durationMinutes || Number(form.durationMinutes) < 1) return setError('Duración debe ser mayor a 0');
    const currentYear = new Date().getFullYear();
    if (!form.year || Number(form.year) < 1888 || Number(form.year) > currentYear) return setError(`Año debe estar entre 1888 y ${currentYear}`);
    if (!unitCostCents || Number(unitCostCents) <= 0) return setError('Costo unitario inválido');
    try {
      const payload = {
        title: form.title,
        genre: form.genre,
        durationMinutes: Number(form.durationMinutes),
        year: Number(form.year),
        unitCost: Number(centsToDisplay(unitCostCents)),
        acquiredUnits: Number(form.acquiredUnits || 0),
        alternateTitles: form.alternateTitles ? form.alternateTitles.split(',').map((s) => s.trim()).filter(Boolean) : [],
        actors: selectedActors.map((name) => ({ name })),
        oscar: {
          categories: Object.entries(oscarSelection).map(([categoria, v]) => ({ categoria, ganó: v.won }))
        }
      };
      const { id } = await api.createVideo(payload);
      if (Number(form.acquiredUnits) > 0) await api.addCopies(id, Number(form.acquiredUnits));
      setMessage(`Película creada (${id})`);
      setForm(emptyVideo);
      setUnitCostCents('');
      setOscarSelection({});
      setSelectedActors([]);
      setActorToAdd('');
      setOscarToAdd('');
      setShowForm(false);
      search();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCopies(videoId) {
    const quantity = Number(prompt('¿Cuántas copias nuevas dar de alta?', '1'));
    if (!quantity || quantity < 1) return;
    setError('');
    try {
      await api.addCopies(videoId, quantity);
      setMessage('Copias agregadas');
      search();
      loadCopies(videoId);
    } catch (err) {
      setError(err.message);
    }
  }

  function openRemovalModal(copyId, videoId) {
    setRemovalTarget({ copyId, videoId });
    setRemovalReason('');
    setRemovalDate(new Date().toISOString().slice(0, 10));
  }

  async function confirmRemoveCopy(e) {
    e.preventDefault();
    if (!removalTarget) return;
    setError('');
    try {
      await api.removeCopy(removalTarget.copyId, removalReason, removalDate);
      setMessage('Copia dada de baja');
      loadCopies(removalTarget.videoId);
      if (removedByVideo[removalTarget.videoId]) loadRemoved(removalTarget.videoId);
      setRemovalTarget(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadRemoved(videoId) {
    try {
      const removed = await api.removedCopies(videoId);
      setRemovedByVideo((prev) => ({ ...prev, [videoId]: removed }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openRemoved(videoId) {
    await loadRemoved(videoId);
    setShowRemovedFor(videoId);
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Películas</h2>
        <button onClick={() => setShowForm(true)}>+ Nueva película</button>
      </div>

      <form className="inline-form" onSubmit={search}>
        <input placeholder="Título" value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value })} />
        <input list="genre-filter-options" placeholder="Género..." value={query.genre} onChange={(e) => setQuery({ ...query, genre: e.target.value })} />
        <datalist id="genre-filter-options">
          {genres.map((g) => <option key={g._id} value={g.valor} />)}
        </datalist>
        <input list="actor-filter-options" placeholder="Actor..." value={query.actor} onChange={(e) => setQuery({ ...query, actor: e.target.value })} />
        <datalist id="actor-filter-options">
          {actorList.map((a) => <option key={a._id} value={a.valor} />)}
        </datalist>
        <input list="oscar-filter-options" placeholder="Nominación/premio Oscar..." value={query.oscar} onChange={(e) => setQuery({ ...query, oscar: e.target.value })} />
        <datalist id="oscar-filter-options">
          {oscarCategories.map((c) => <option key={c._id} value={c.valor} />)}
        </datalist>
        <button type="submit">Buscar</button>
      </form>

      <Banner error={error} message={message} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Título</th><th>Año</th><th>Género</th><th>Actores</th><th>Oscar</th><th>Costo</th><th>Unidades</th><th></th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <>
                <tr key={v._id}>
                  <td>
                    <strong>{v.title}</strong>
                    {v.alternateTitles?.length > 0 && <div className="muted small">{v.alternateTitles.join(', ')}</div>}
                  </td>
                  <td>{v.year}</td>
                  <td>{v.genre}</td>
                  <td className="muted">{v.actors?.map((a) => a.name).join(', ') || '—'}</td>
                  <td className="muted">
                    {v.oscar?.categories?.length > 0
                      ? v.oscar.categories.map((c) => `${c.categoria}${c.ganó ? ' 🏆' : ''}`).join(', ')
                      : '—'}
                  </td>
                  <td>${v.unitCost}</td>
                  <td>{v.acquiredUnits}</td>
                  <td>
                    <div className="video-actions">
                      <button className="btn-ok" onClick={() => addCopies(v._id)}>+ Copias</button>
                      <button className="btn-info" onClick={() => loadCopies(v._id)}>Ver stock</button>
                      <button className="btn-warn" onClick={() => openRemoved(v._id)}>Ver bajas</button>
                    </div>
                  </td>
                </tr>
                {copiesByVideo[v._id] && (
                  <tr>
                    <td colSpan="8">
                      <div className="copy-list">
                        {copiesByVideo[v._id].length === 0 && <span className="muted">Sin copias</span>}
                        {copiesByVideo[v._id].map((c) => (
                          <span key={c._id} className={`copy-chip ${c.status === 'rented' ? 'copy-chip-rented' : ''}`} title={c.status === 'rented' ? 'Rentada' : 'Disponible'}>
                            #{c._id.slice(-6)}
                            {c.status === 'available' && (
                              <button className="btn-remove" title="Dar de baja" onClick={() => openRemovalModal(c._id, v._id)}>✕</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {videos.length === 0 && <tr><td colSpan="8" className="muted">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} title="Registrar película" onClose={() => setShowForm(false)}>
        <form className="stack-form" onSubmit={createVideo}>
          <input required placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Títulos alternativos (separados por coma)" value={form.alternateTitles} onChange={(e) => setForm({ ...form, alternateTitles: e.target.value })} />
          <div className="row">
            <select required value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
              <option value="">Género...</option>
              {genres.map((g) => <option key={g._id} value={g.valor}>{g.descripcion}</option>)}
            </select>
            <button type="button" className="btn-add" title="Nuevo género" onClick={() => setShowGenreForm(true)}>+</button>
          </div>
          <div className="row">
            <input required type="number" placeholder="Duración (min)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <input required type="number" placeholder="Año" min="1888" max={new Date().getFullYear()} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.slice(0, 4) })} />
          </div>
          <div className="row">
            <input
              required
              inputMode="numeric"
              placeholder="Costo unitario"
              value={centsToDisplay(unitCostCents)}
              onKeyDown={(e) => { if (e.key === 'Backspace') { e.preventDefault(); setUnitCostCents((c) => c.slice(0, -1)); } }}
              onChange={(e) => { const typed = e.nativeEvent.data; if (typed && /\d/.test(typed)) setUnitCostCents((c) => (c + typed).slice(-9)); }}
            />
            <input type="number" placeholder="Unidades a adquirir" max="999" value={form.acquiredUnits} onChange={(e) => setForm({ ...form, acquiredUnits: e.target.value.slice(0, 3) })} />
          </div>
          <div className="oscar-checklist">
            <div className="card-head">
              <label>Actores</label>
              <button type="button" onClick={() => setShowActorForm(true)}>+ Nuevo</button>
            </div>
            <div className="row">
              <select value={actorToAdd} onChange={(e) => setActorToAdd(e.target.value)}>
                <option value="">Seleccionar actor...</option>
                {actorList.filter((a) => !selectedActors.includes(a.valor)).map((a) => (
                  <option key={a._id} value={a.valor}>{a.descripcion}</option>
                ))}
              </select>
              <button type="button" className="btn-add" title="Adicionar" onClick={addActor} disabled={!actorToAdd}>+</button>
            </div>
            <div className="copy-list">
              {selectedActors.map((name) => (
                <span key={name} className="copy-chip">
                  {name}
                  <button type="button" title="Quitar" onClick={() => removeActor(name)}>✕</button>
                </span>
              ))}
              {selectedActors.length === 0 && <span className="muted small">Sin actores agregados</span>}
            </div>
          </div>

          <div className="oscar-checklist">
            <div className="card-head">
              <label>Nominaciones Oscar</label>
              <button type="button" onClick={() => setShowOscarForm(true)}>+ Nueva</button>
            </div>
            <div className="row">
              <select value={oscarToAdd} onChange={(e) => setOscarToAdd(e.target.value)}>
                <option value="">Seleccionar categoría...</option>
                {oscarCategories.filter((c) => !oscarSelection[c.valor]).map((c) => (
                  <option key={c._id} value={c.valor}>{c.descripcion}</option>
                ))}
              </select>
              <button type="button" className="btn-add" title="Adicionar" onClick={addOscarCategory} disabled={!oscarToAdd}>+</button>
            </div>
            {Object.keys(oscarSelection).map((categoria) => (
              <label key={categoria} className="row oscar-row">
                <span>{categoria}</span>
                <span className="checkbox">
                  <input type="checkbox" checked={oscarSelection[categoria].won} onChange={() => toggleOscarWon(categoria)} /> Ganó
                </span>
                <button type="button" className="btn-remove" title="Quitar" onClick={() => removeOscarCategory(categoria)}>✕</button>
              </label>
            ))}
            {Object.keys(oscarSelection).length === 0 && <span className="muted small">Sin categorías agregadas</span>}
          </div>

          <button type="submit">Registrar</button>
        </form>
      </Modal>

      <Modal open={showGenreForm} title="Nuevo género" onClose={() => setShowGenreForm(false)}>
        <form className="stack-form" onSubmit={createGenre}>
          <input required autoFocus placeholder="Nombre del género" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} />
          <button type="submit">Guardar</button>
        </form>
      </Modal>

      <Modal open={showOscarForm} title="Nueva categoría Oscar" onClose={() => setShowOscarForm(false)}>
        <form className="stack-form" onSubmit={createOscarCategory}>
          <input required autoFocus placeholder="Nombre de la categoría" value={newOscarCategory} onChange={(e) => setNewOscarCategory(e.target.value)} />
          <button type="submit">Guardar</button>
        </form>
      </Modal>

      <Modal open={showActorForm} title="Nuevo actor" onClose={() => setShowActorForm(false)}>
        <form className="stack-form" onSubmit={createActor}>
          <input required autoFocus placeholder="Nombre del actor" value={newActor} onChange={(e) => setNewActor(e.target.value)} />
          <button type="submit">Guardar</button>
        </form>
      </Modal>

      <Modal open={!!removalTarget} title="Dar de baja copia" onClose={() => setRemovalTarget(null)}>
        <form className="stack-form" onSubmit={confirmRemoveCopy}>
          <input required autoFocus placeholder="Razón (no devuelto, robo, dañado...)" value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} />
          <input required type="date" max={new Date().toISOString().slice(0, 10)} value={removalDate} onChange={(e) => setRemovalDate(e.target.value)} />
          <button type="submit">Confirmar baja</button>
        </form>
      </Modal>

      <Modal open={!!showRemovedFor} title="Copias dadas de baja" onClose={() => setShowRemovedFor(null)}>
        <ul className="item-list">
          {(removedByVideo[showRemovedFor] || []).map((c) => (
            <li key={c._id}>
              <span>#{c._id.slice(-6)} · {new Date(c.removedAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              <span className="muted">{c.removalReason}</span>
            </li>
          ))}
          {(removedByVideo[showRemovedFor] || []).length === 0 && <li className="muted">Sin bajas registradas</li>}
        </ul>
      </Modal>
    </section>
  );
}
