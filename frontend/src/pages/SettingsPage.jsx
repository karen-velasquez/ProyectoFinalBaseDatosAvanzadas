import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

function centsToDisplay(digits) {
  return (Number(digits || '0') / 100).toFixed(2);
}

export default function SettingsPage() {
  const [policy, setPolicy] = useState(null);
  const [rateCents, setRateCents] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getPolicy().then((p) => {
      setPolicy(p);
      setRateCents(p.ratesByDays.map((r) => String(Math.round(r.rate * 100))));
    }).catch((err) => setError(err.message));
  }, []);

  function updateRateCents(index, cents) {
    setRateCents((prev) => { const next = [...prev]; next[index] = cents; return next; });
    setPolicy((prev) => {
      const ratesByDays = [...prev.ratesByDays];
      ratesByDays[index] = { ...ratesByDays[index], rate: Number(centsToDisplay(cents)) };
      return { ...prev, ratesByDays };
    });
  }

  function updateDiscount(index, field, value) {
    setPolicy((prev) => {
      const discounts = [...prev.discounts];
      discounts[index] = { ...discounts[index], [field]: value === '' ? null : Number(value) };
      return { ...prev, discounts };
    });
  }

  function addDiscount() {
    setPolicy((prev) => {
      const lastMax = prev.discounts.reduce((max, d) => (d.maximumItems == null ? max : Math.max(max, d.maximumItems)), 2);
      return { ...prev, discounts: [...prev.discounts, { minimumItems: lastMax + 1, maximumItems: null, percentage: 0 }] };
    });
  }

  function removeDiscount(index) {
    setPolicy((prev) => ({ ...prev, discounts: prev.discounts.filter((_, i) => i !== index) }));
  }

  async function save(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const { _id, ...rest } = policy;
      const body = { ...rest, discounts: [...rest.discounts].sort((a, b) => a.minimumItems - b.minimumItems) };
      const updated = await api.updatePolicy(body);
      setPolicy(updated);
      setMessage('Política actualizada');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!policy) return <Banner error={error} />;

  return (
    <section className="card" style={{ maxWidth: '640px' }}>
      <h2>Tarifas y descuentos</h2>
      <Banner error={error} message={message} />
      <form className="stack-form" onSubmit={save}>
        <label>
          Máximo de días por renta
          <input type="number" min="1" max="5" value={policy.maxDays} onChange={(e) => setPolicy({ ...policy, maxDays: Number(e.target.value) })} />
        </label>

        <h3>Tarifa por días de renta</h3>
        {policy.ratesByDays.map((r, i) => (
          <div className="row" key={r.days}>
            <span style={{ alignSelf: 'center', minWidth: '70px' }}>{r.days} día{r.days > 1 ? 's' : ''}</span>
            <input
              inputMode="numeric"
              placeholder="Tarifa (Bs)"
              value={centsToDisplay(rateCents[i])}
              onKeyDown={(e) => { if (e.key === 'Backspace') { e.preventDefault(); updateRateCents(i, (rateCents[i] || '').slice(0, -1)); } }}
              onChange={(e) => { const typed = e.nativeEvent.data; if (typed && /\d/.test(typed)) updateRateCents(i, ((rateCents[i] || '') + typed).slice(-9)); }}
            />
          </div>
        ))}

        <h3>Descuentos por cantidad</h3>
        <p className="muted small">Rango de cantidad de películas y el descuento que aplica. Deja "Hasta" vacío para "sin límite" en el último tramo.</p>
        {policy.discounts.map((d, i) => (
          <div className="row" key={i}>
            <label>
              Desde
              <input type="number" min="1" value={d.minimumItems} onChange={(e) => updateDiscount(i, 'minimumItems', e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="number" min="1" placeholder="Sin límite" value={d.maximumItems ?? ''} onChange={(e) => updateDiscount(i, 'maximumItems', e.target.value)} />
            </label>
            <label>
              % descuento
              <input type="number" min="0" max="100" value={d.percentage} onChange={(e) => updateDiscount(i, 'percentage', Math.min(100, Math.max(0, Number(e.target.value))))} />
            </label>
            <button type="button" className="btn-remove" style={{ alignSelf: 'flex-end' }} onClick={() => removeDiscount(i)}>✕</button>
          </div>
        ))}
        <button type="button" onClick={addDiscount}>+ Agregar rango</button>

        <button type="submit">Guardar</button>
      </form>
    </section>
  );
}
