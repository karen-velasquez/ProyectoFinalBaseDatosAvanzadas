import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

export default function SettingsPage() {
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getPolicy().then(setPolicy).catch((err) => setError(err.message));
  }, []);

  function updateRate(index, value) {
    setPolicy((prev) => {
      const ratesByDays = [...prev.ratesByDays];
      ratesByDays[index] = { ...ratesByDays[index], rate: Number(value) };
      return { ...prev, ratesByDays };
    });
  }

  function updateDiscount(index, field, value) {
    setPolicy((prev) => {
      const discounts = [...prev.discounts];
      discounts[index] = { ...discounts[index], [field]: Number(value) };
      return { ...prev, discounts };
    });
  }

  function addDiscount() {
    setPolicy((prev) => ({ ...prev, discounts: [...prev.discounts, { minimumItems: 0, percentage: 0 }] }));
  }

  function removeDiscount(index) {
    setPolicy((prev) => ({ ...prev, discounts: prev.discounts.filter((_, i) => i !== index) }));
  }

  async function save(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const { _id, ...body } = policy;
      const updated = await api.updatePolicy(body);
      setPolicy(updated);
      setMessage('Política actualizada');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!policy) return <Banner error={error} />;

  return (
    <section className="card" style={{ maxWidth: '480px' }}>
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
            <input type="number" step="0.01" placeholder="Tarifa (Bs)" value={r.rate} onChange={(e) => updateRate(i, e.target.value)} />
          </div>
        ))}

        <h3>Descuentos por cantidad</h3>
        {policy.discounts.map((d, i) => (
          <div className="row" key={i}>
            <input type="number" placeholder="Mínimo de películas" value={d.minimumItems} onChange={(e) => updateDiscount(i, 'minimumItems', e.target.value)} />
            <input type="number" placeholder="% descuento" value={d.percentage} onChange={(e) => updateDiscount(i, 'percentage', e.target.value)} />
            <button type="button" onClick={() => removeDiscount(i)}>✕</button>
          </div>
        ))}
        <button type="button" onClick={addDiscount}>+ Agregar tramo</button>

        <button type="submit">Guardar</button>
      </form>
    </section>
  );
}
