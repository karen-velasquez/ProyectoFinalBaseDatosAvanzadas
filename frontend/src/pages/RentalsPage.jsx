import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

export default function RentalsPage() {
  const [customers, setCustomers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [days, setDays] = useState(1);
  const [items, setItems] = useState([]);
  const [pickVideo, setPickVideo] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listCustomers().then(setCustomers).catch((err) => setError(err.message));
    api.searchVideos({}).then(setVideos).catch((err) => setError(err.message));
  }, []);

  function addItem() {
    if (!pickVideo) return;
    const video = videos.find((v) => v._id === pickVideo);
    setItems((prev) => [...prev, { videoId: pickVideo, title: video?.title, quantity: Number(pickQty) || 1 }]);
    setPickVideo(''); setPickQty(1);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitRental(e) {
    e.preventDefault();
    setError(''); setInvoice(null);
    if (!customerId) return setError('Selecciona un cliente');
    if (items.length === 0) return setError('Agrega al menos una película');
    try {
      const loan = await api.rent({ customerId, days: Number(days), items: items.map(({ videoId, quantity }) => ({ videoId, quantity })) });
      setInvoice(loan);
      setItems([]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Nueva renta</h2>
        <Banner error={error} />
        <form className="stack-form" onSubmit={submitRental}>
          <label>
            Cliente
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Selecciona...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id} disabled={c.blocked}>
                  {c.fullName}{c.blocked ? ' (bloqueado)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Días de renta (1–5)
            <input type="number" min="1" max="5" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>

          <div className="row">
            <select value={pickVideo} onChange={(e) => setPickVideo(e.target.value)}>
              <option value="">Elegir película...</option>
              {videos.map((v) => <option key={v._id} value={v._id}>{v.title}</option>)}
            </select>
            <input type="number" min="1" value={pickQty} onChange={(e) => setPickQty(e.target.value)} style={{ width: '70px' }} />
            <button type="button" onClick={addItem}>Agregar</button>
          </div>

          <ul className="item-list">
            {items.map((it, i) => (
              <li key={i}>
                {it.title} × {it.quantity} <button type="button" onClick={() => removeItem(i)}>✕</button>
              </li>
            ))}
          </ul>

          <button type="submit" disabled={items.length === 0}>Confirmar renta</button>
        </form>
        <p className="muted small">La transacción valida stock disponible y bloqueo del cliente de forma atómica antes de descontar copias.</p>
      </section>

      <section className="card">
        <h2>Factura</h2>
        {!invoice && <p className="muted">Confirma una renta para ver la factura aquí.</p>}
        {invoice && (
          <div className="invoice">
            <div><span>Préstamo</span><strong>#{invoice._id.slice(-8)}</strong></div>
            <ul>
              {invoice.items.map((it, i) => <li key={i}>{it.title} — Bs {it.unitRate} por {invoice.days} día{invoice.days > 1 ? 's' : ''}</li>)}
            </ul>
            <div><span>Días</span><strong>{invoice.days}</strong></div>
            <div><span>Subtotal</span><strong>${invoice.subtotal.toFixed(2)}</strong></div>
            <div><span>Descuento</span><strong>{invoice.discountPercentage}%</strong></div>
            <div className="invoice-total"><span>Total</span><strong>${invoice.total.toFixed(2)}</strong></div>
          </div>
        )}
      </section>
    </div>
  );
}
