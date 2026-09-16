import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';
import Modal from '../components/Modal.jsx';

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RentalsPage() {
  const [customers, setCustomers] = useState([]);
  const [maxDays, setMaxDays] = useState(5);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState({ q: '', genre: '', actor: '', oscar: '' });
  const [results, setResults] = useState([]);
  const [genres, setGenres] = useState([]);
  const [actorList, setActorList] = useState([]);
  const [oscarCategories, setOscarCategories] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [invoice, setInvoice] = useState(null);

  const [showCheckout, setShowCheckout] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [dueDates, setDueDates] = useState({});

  useEffect(() => {
    api.listCustomers(false).then(setCustomers).catch((err) => setError(err.message));
    api.getPolicy().then((p) => setMaxDays(p.maxDays)).catch((err) => setError(err.message));
    api.listGeneros().then(setGenres).catch(() => {});
    api.listParametros('actor').then(setActorList).catch(() => {});
    api.listParametros('categoria_oscar').then(setOscarCategories).catch(() => {});
  }, []);

  async function search(e) {
    e?.preventDefault();
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
      setResults(await api.availableVideosForRental(params));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { search(); }, []);

  function isInCart(videoId) {
    return items.some((it) => it.videoId === videoId);
  }

  function addToCart(video) {
    if (isInCart(video._id)) return;
    setItems((prev) => [...prev, { videoId: video._id, title: video.title, quantity: 1 }]);
  }

  function removeItem(videoId) {
    setItems((prev) => prev.filter((it) => it.videoId !== videoId));
  }

  function openCheckout() {
    setError('');
    setDueDates(Object.fromEntries(items.map((it) => [it.videoId, todayPlusDays(1)])));
    setShowCheckout(true);
  }

  async function submitRental(e) {
    e.preventDefault();
    setError(''); setInvoice(null);
    if (!customerId) return setError('Selecciona un cliente');
    try {
      const loan = await api.rent({
        customerId,
        items: items.map(({ videoId, quantity }) => ({ videoId, quantity, dueDate: dueDates[videoId] }))
      });
      setInvoice(loan);
      setItems([]);
      setShowCheckout(false);
      setMessage('Factura emitida');
      search();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rental-layout">
      <section className="card">
        <h2>Buscar películas</h2>
        <div className="inline-form">
          <input placeholder="Título" value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value })} />
          <input list="rental-genre-options" placeholder="Género..." value={query.genre} onChange={(e) => setQuery({ ...query, genre: e.target.value })} />
          <datalist id="rental-genre-options">
            {genres.map((g) => <option key={g._id} value={g.valor} />)}
          </datalist>
          <input list="rental-actor-options" placeholder="Actor..." value={query.actor} onChange={(e) => setQuery({ ...query, actor: e.target.value })} />
          <datalist id="rental-actor-options">
            {actorList.map((a) => <option key={a._id} value={a.valor} />)}
          </datalist>
          <input list="rental-oscar-options" placeholder="Nominación/premio Oscar..." value={query.oscar} onChange={(e) => setQuery({ ...query, oscar: e.target.value })} />
          <datalist id="rental-oscar-options">
            {oscarCategories.map((c) => <option key={c._id} value={c.valor} />)}
          </datalist>
          <button type="button" onClick={search}>Buscar</button>
        </div>

        <Banner error={error} message={message} />

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Título</th><th>Año</th><th>Género</th><th>Disponibles</th><th></th></tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v._id}>
                  <td><strong>{v.title}</strong></td>
                  <td>{v.year}</td>
                  <td>{v.genre}</td>
                  <td className="muted">{v.availableCount}</td>
                  <td>
                    <button type="button" className="btn-ok" disabled={isInCart(v._id)} onClick={() => addToCart(v)}>+</button>
                  </td>
                </tr>
              ))}
              {results.length === 0 && <tr><td colSpan="5" className="muted">Busca películas para agregar</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card cart-card">
        <h2>Carrito</h2>
        <ul className="item-list">
          {items.map((it) => (
            <li key={it.videoId}>
              {it.title}
              <button type="button" className="btn-remove" onClick={() => removeItem(it.videoId)}>✕</button>
            </li>
          ))}
          {items.length === 0 && <li className="muted">Carrito vacío</li>}
        </ul>
        <button type="button" disabled={items.length === 0} onClick={openCheckout}>Facturar</button>
      </section>

      <Modal open={showCheckout} title="Facturar renta" onClose={() => setShowCheckout(false)}>
        <form className="stack-form" onSubmit={submitRental}>
          <label>
            Cliente
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Selecciona...</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.fullName}</option>)}
            </select>
          </label>

          <h3>Fecha de devolución por película</h3>
          {items.map((it) => (
            <label key={it.videoId}>
              {it.title}
              <input
                required
                type="date"
                min={todayPlusDays(1)}
                max={todayPlusDays(maxDays)}
                value={dueDates[it.videoId] || ''}
                onChange={(e) => setDueDates({ ...dueDates, [it.videoId]: e.target.value })}
              />
            </label>
          ))}

          <button type="submit">Emitir factura</button>
        </form>
      </Modal>

      <Modal open={!!invoice} title="Factura emitida" onClose={() => setInvoice(null)}>
        {invoice && (
          <div className="invoice">
            <div><span>Préstamo</span><strong>#{invoice._id.slice(-8)}</strong></div>
            <ul>
              {invoice.items.map((it, i) => (
                <li key={i}>{it.title} — Bs {it.unitRate} × {it.days} día{it.days > 1 ? 's' : ''} (vence {new Date(it.dueDate).toLocaleDateString()})</li>
              ))}
            </ul>
            <div><span>Subtotal</span><strong>Bs {invoice.subtotal.toFixed(2)}</strong></div>
            <div><span>Descuento</span><strong>{invoice.discountPercentage}%</strong></div>
            <div className="invoice-total"><span>Total</span><strong>Bs {invoice.total.toFixed(2)}</strong></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
