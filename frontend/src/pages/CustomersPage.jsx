import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

const emptyCustomer = { fullName: '', phone: '', email: '', birthDate: '', city: '', street: '', lat: '', lng: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setError('');
    try {
      setCustomers(await api.listCustomers(onlyBlocked ? true : undefined));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [onlyBlocked]);

  async function createCustomer(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const payload = {
        fullName: form.fullName, phone: form.phone, email: form.email, birthDate: form.birthDate,
        address: { street: form.street, city: form.city }
      };
      if (form.lat && form.lng) payload.location = { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] };
      await api.createCustomer(payload);
      setMessage('Cliente registrado');
      setForm(emptyCustomer);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function block(id) {
    const reason = prompt('Razón del bloqueo:');
    if (!reason) return;
    setError('');
    try {
      await api.blockCustomer(id, reason);
      setMessage('Cliente bloqueado');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <div className="card-head">
          <h2>Clientes</h2>
          <label className="checkbox">
            <input type="checkbox" checked={onlyBlocked} onChange={(e) => setOnlyBlocked(e.target.checked)} />
            Solo bloqueados
          </label>
        </div>

        <Banner error={error} message={message} />

        <ul className="video-list">
          {customers.map((c) => (
            <li key={c._id} className="video-item">
              <div className="video-item-head">
                <strong>{c.fullName}</strong> {c.blocked && <span className="badge badge-danger">Bloqueado</span>}
              </div>
              <div className="muted">{c.email} · {c.phone}</div>
              {c.address && <div className="muted">{c.address.street}, {c.address.city}</div>}
              {c.blocked && <div className="muted">Motivo: {c.blockReason}</div>}
              {!c.blocked && (
                <div className="video-actions">
                  <button onClick={() => block(c._id)}>Bloquear</button>
                </div>
              )}
            </li>
          ))}
          {customers.length === 0 && <li className="muted">Sin clientes</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Registrar cliente</h2>
        <form className="stack-form" onSubmit={createCustomer}>
          <input required placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <div className="row">
            <input required placeholder="Celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input required type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <input required type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <input placeholder="Dirección" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          <input placeholder="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <div className="row">
            <input type="number" step="any" placeholder="Latitud" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            <input type="number" step="any" placeholder="Longitud" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          </div>
          <button type="submit">Registrar</button>
        </form>
      </section>
    </div>
  );
}
