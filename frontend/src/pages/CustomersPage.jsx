import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';
import Modal from '../components/Modal.jsx';
import LocationPicker from '../components/LocationPicker.jsx';

const emptyCustomer = { fullName: '', phone: '', email: '', birthDate: '', gender: '', street: '', reference: '', lat: '', lng: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[67]\d{6}$/;

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [genders, setGenders] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockDate, setBlockDate] = useState('');

  async function load() {
    setError('');
    try {
      setCustomers(await api.listCustomers(onlyBlocked));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [onlyBlocked]);
  useEffect(() => { api.listParametros('genero').then(setGenders).catch(() => {}); }, []);

  async function createCustomer(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!EMAIL_RE.test(form.email)) return setError('Correo inválido');
    if (!PHONE_RE.test(form.phone)) return setError('Teléfono debe tener 7 dígitos y empezar con 6 o 7');
    try {
      const payload = {
        fullName: form.fullName, phone: form.phone, email: form.email, birthDate: form.birthDate, gender: form.gender,
        address: { street: form.street, reference: form.reference }
      };
      if (form.lat && form.lng) payload.location = { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] };
      await api.createCustomer(payload);
      setMessage('Cliente registrado');
      setForm(emptyCustomer);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(c) {
    setEditForm({
      _id: c._id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      birthDate: c.birthDate ? c.birthDate.slice(0, 10) : '',
      gender: c.gender || '',
      street: c.address?.street || '',
      reference: c.address?.reference || '',
      lat: c.location?.coordinates?.[1] ?? '',
      lng: c.location?.coordinates?.[0] ?? ''
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!EMAIL_RE.test(editForm.email)) return setError('Correo inválido');
    if (!PHONE_RE.test(editForm.phone)) return setError('Teléfono debe tener 7 dígitos y empezar con 6 o 7');
    try {
      const payload = {
        fullName: editForm.fullName, phone: editForm.phone, email: editForm.email, birthDate: editForm.birthDate, gender: editForm.gender,
        address: { street: editForm.street, reference: editForm.reference }
      };
      if (editForm.lat && editForm.lng) payload.location = { type: 'Point', coordinates: [Number(editForm.lng), Number(editForm.lat)] };
      await api.updateCustomer(editForm._id, payload);
      setMessage('Cliente actualizado');
      setEditForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openBlock(id) {
    setBlockTarget(id);
    setBlockReason('');
    setBlockDate(new Date().toISOString().slice(0, 10));
  }

  async function confirmBlock(e) {
    e.preventDefault();
    setError('');
    try {
      await api.blockCustomer(blockTarget, blockReason, blockDate);
      setMessage('Cliente bloqueado');
      setBlockTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Clientes</h2>
        <button onClick={() => setShowForm(true)}>+ Nuevo cliente</button>
      </div>

      <div className="tabs">
        <button type="button" className={!onlyBlocked ? 'active' : ''} onClick={() => setOnlyBlocked(false)}>Activos</button>
        <button type="button" className={onlyBlocked ? 'active' : ''} onClick={() => setOnlyBlocked(true)}>Bloqueados</button>
      </div>

      <Banner error={error} message={message} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Nombre</th><th>Contacto</th><th>Dirección</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id}>
                <td><strong>{c.fullName}</strong></td>
                <td className="muted">{c.email} · {c.phone}</td>
                <td className="muted">{c.address?.street ? `${c.address.street}${c.address.reference ? ` (${c.address.reference})` : ''}` : '—'}</td>
                <td>
                  {c.blocked
                    ? <span className="badge badge-danger" title={c.blockReason}>Bloqueado</span>
                    : <span className="muted">Activo</span>}
                </td>
                <td>
                  <div className="video-actions">
                    <button className="btn-info" onClick={() => openEdit(c)}>Editar</button>
                    {!c.blocked && <button className="btn-warn" onClick={() => openBlock(c._id)}>Bloquear</button>}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan="5" className="muted">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} title="Registrar cliente" onClose={() => setShowForm(false)}>
        <form className="stack-form" onSubmit={createCustomer}>
          <input required placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <div className="row">
            <div className="field-with-note">
              <div className="field-with-hint">
                <input
                  required
                  inputMode="numeric"
                  placeholder="Celular"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                  className={form.phone && !PHONE_RE.test(form.phone) ? 'input-invalid' : ''}
                />
                <span className={`field-hint ${form.phone.length === 7 ? 'field-hint-ok' : ''}`}>{form.phone.length}/7</span>
              </div>
              {form.phone && !/^[67]/.test(form.phone) && (
                <span className="field-note">Debe empezar con 6 o 7</span>
              )}
            </div>
            <div className="field-with-note">
              <input
                required
                type="email"
                placeholder="Correo"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={form.email && !EMAIL_RE.test(form.email) ? 'input-invalid' : ''}
              />
              {form.email && !EMAIL_RE.test(form.email) && (
                <span className="field-note">Debe tener @ y un dominio, ej: nombre@correo.com</span>
              )}
            </div>
          </div>
          <div className="row">
            <input required type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            <select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Género...</option>
              {genders.map((g) => <option key={g._id} value={g.valor}>{g.descripcion}</option>)}
            </select>
          </div>
          <LocationPicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng, street) => setForm({ ...form, lat, lng, street })}
          />
          <input readOnly placeholder="Dirección (se llena al marcar el mapa)" value={form.street} />
          <input placeholder="Número de puerta / referencia" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          <button type="submit">Registrar</button>
        </form>
      </Modal>

      <Modal open={!!editForm} title="Editar cliente" onClose={() => setEditForm(null)}>
        {editForm && (
          <form className="stack-form" onSubmit={saveEdit}>
            <input required placeholder="Nombre completo" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            <div className="row">
              <div className="field-with-note">
                <div className="field-with-hint">
                  <input
                    required
                    inputMode="numeric"
                    placeholder="Celular"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    className={editForm.phone && !PHONE_RE.test(editForm.phone) ? 'input-invalid' : ''}
                  />
                  <span className={`field-hint ${editForm.phone.length === 7 ? 'field-hint-ok' : ''}`}>{editForm.phone.length}/7</span>
                </div>
                {editForm.phone && !/^[67]/.test(editForm.phone) && (
                  <span className="field-note">Debe empezar con 6 o 7</span>
                )}
              </div>
              <div className="field-with-note">
                <input
                  required
                  type="email"
                  placeholder="Correo"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={editForm.email && !EMAIL_RE.test(editForm.email) ? 'input-invalid' : ''}
                />
                {editForm.email && !EMAIL_RE.test(editForm.email) && (
                  <span className="field-note">Debe tener @ y un dominio, ej: nombre@correo.com</span>
                )}
              </div>
            </div>
            <div className="row">
              <input required type="date" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} />
              <select required value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                <option value="">Género...</option>
                {genders.map((g) => <option key={g._id} value={g.valor}>{g.descripcion}</option>)}
              </select>
            </div>
            <LocationPicker
              lat={editForm.lat}
              lng={editForm.lng}
              onChange={(lat, lng, street) => setEditForm({ ...editForm, lat, lng, street })}
            />
            <input readOnly placeholder="Dirección (se llena al marcar el mapa)" value={editForm.street} />
            <input placeholder="Número de puerta / referencia" value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} />
            <button type="submit">Guardar cambios</button>
          </form>
        )}
      </Modal>

      <Modal open={!!blockTarget} title="Bloquear cliente" onClose={() => setBlockTarget(null)}>
        <form className="stack-form" onSubmit={confirmBlock}>
          <input required autoFocus placeholder="Razón del bloqueo" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          <input required type="date" max={new Date().toISOString().slice(0, 10)} value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
          <button type="submit">Confirmar bloqueo</button>
        </form>
      </Modal>
    </section>
  );
}
