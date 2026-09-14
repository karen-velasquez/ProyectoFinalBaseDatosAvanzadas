import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

const emptyVideo = {
  title: '', alternateTitles: '', genre: '', durationMinutes: '', year: '',
  unitCost: '', acquiredUnits: '', actors: '', oscarNominations: '', oscarWins: ''
};

export default function VideosPage() {
  const [query, setQuery] = useState({ q: '', genre: '', actor: '', oscar: '' });
  const [videos, setVideos] = useState([]);
  const [copiesByVideo, setCopiesByVideo] = useState({});
  const [form, setForm] = useState(emptyVideo);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    if (!form.year || Number(form.year) < 1888) return setError('Año inválido');
    if (form.unitCost === '' || Number(form.unitCost) < 0) return setError('Costo unitario inválido');
    try {
      const payload = {
        title: form.title,
        genre: form.genre,
        durationMinutes: Number(form.durationMinutes),
        year: Number(form.year),
        unitCost: Number(form.unitCost),
        acquiredUnits: Number(form.acquiredUnits || 0),
        alternateTitles: form.alternateTitles ? form.alternateTitles.split(',').map((s) => s.trim()).filter(Boolean) : [],
        actors: form.actors ? form.actors.split(',').map((name) => ({ name: name.trim() })).filter((a) => a.name) : [],
        oscar: {
          nominations: form.oscarNominations ? form.oscarNominations.split(',').map((s) => s.trim()).filter(Boolean) : [],
          wins: form.oscarWins ? form.oscarWins.split(',').map((s) => s.trim()).filter(Boolean) : []
        }
      };
      const { id } = await api.createVideo(payload);
      if (Number(form.acquiredUnits) > 0) await api.addCopies(id, Number(form.acquiredUnits));
      setMessage(`Película creada (${id})`);
      setForm(emptyVideo);
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

  async function removeCopy(copyId, videoId) {
    const reason = prompt('Razón de la baja (no devuelto, robo, dañado...):');
    if (!reason) return;
    setError('');
    try {
      await api.removeCopy(copyId, reason);
      setMessage('Copia dada de baja');
      loadCopies(videoId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Buscar películas</h2>
        <form className="inline-form" onSubmit={search}>
          <input placeholder="Título" value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value })} />
          <input placeholder="Género" value={query.genre} onChange={(e) => setQuery({ ...query, genre: e.target.value })} />
          <input placeholder="Actor" value={query.actor} onChange={(e) => setQuery({ ...query, actor: e.target.value })} />
          <input placeholder="Nominación/premio Oscar" value={query.oscar} onChange={(e) => setQuery({ ...query, oscar: e.target.value })} />
          <button type="submit">Buscar</button>
        </form>

        <Banner error={error} message={message} />

        <ul className="video-list">
          {videos.map((v) => (
            <li key={v._id} className="video-item">
              <div className="video-item-head">
                <strong>{v.title}</strong> <span className="muted">({v.year} · {v.genre})</span>
              </div>
              {v.alternateTitles?.length > 0 && <div className="muted">Títulos alternos: {v.alternateTitles.join(', ')}</div>}
              {v.actors?.length > 0 && <div className="muted">Actores: {v.actors.map((a) => a.name).join(', ')}</div>}
              {(v.oscar?.wins?.length > 0 || v.oscar?.nominations?.length > 0) && (
                <div className="muted">
                  Oscar — Nominaciones: {v.oscar.nominations?.join(', ') || '—'} · Ganó: {v.oscar.wins?.join(', ') || '—'}
                </div>
              )}
              <div className="muted">Costo unitario: ${v.unitCost} · Unidades adquiridas: {v.acquiredUnits}</div>
              <div className="video-actions">
                <button onClick={() => addCopies(v._id)}>+ Alta de copias</button>
                <button onClick={() => loadCopies(v._id)}>Ver stock disponible</button>
              </div>
              {copiesByVideo[v._id] && (
                <div className="copy-list">
                  {copiesByVideo[v._id].length === 0 && <span className="muted">Sin copias disponibles</span>}
                  {copiesByVideo[v._id].map((c) => (
                    <span key={c._id} className="copy-chip">
                      #{c._id.slice(-6)}
                      <button title="Dar de baja" onClick={() => removeCopy(c._id, v._id)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {videos.length === 0 && <li className="muted">Sin resultados</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Registrar película</h2>
        <form className="stack-form" onSubmit={createVideo}>
          <input required placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Títulos alternativos (separados por coma)" value={form.alternateTitles} onChange={(e) => setForm({ ...form, alternateTitles: e.target.value })} />
          <input required placeholder="Género" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
          <div className="row">
            <input required type="number" placeholder="Duración (min)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <input required type="number" placeholder="Año" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div className="row">
            <input required type="number" step="0.01" placeholder="Costo unitario" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            <input type="number" placeholder="Unidades a adquirir" value={form.acquiredUnits} onChange={(e) => setForm({ ...form, acquiredUnits: e.target.value })} />
          </div>
          <input placeholder="Actores principales (separados por coma)" value={form.actors} onChange={(e) => setForm({ ...form, actors: e.target.value })} />
          <input placeholder="Nominaciones al Oscar (separadas por coma)" value={form.oscarNominations} onChange={(e) => setForm({ ...form, oscarNominations: e.target.value })} />
          <input placeholder="Premios Oscar ganados (separados por coma)" value={form.oscarWins} onChange={(e) => setForm({ ...form, oscarWins: e.target.value })} />
          <button type="submit">Registrar</button>
        </form>
      </section>
    </div>
  );
}
