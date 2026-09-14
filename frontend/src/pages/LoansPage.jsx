import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Banner from '../components/Banner.jsx';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setError('');
    try {
      setLoans(await api.activeLoans());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function returnLoan(id) {
    setError(''); setMessage('');
    try {
      await api.returnLoan(id);
      setMessage('Devolución registrada');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Préstamos activos</h2>
        <button onClick={load}>Refrescar</button>
      </div>
      <Banner error={error} message={message} />
      <table className="table">
        <thead>
          <tr><th>Préstamo</th><th>Cliente</th><th>Películas</th><th>Vence</th><th>Total</th><th></th></tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan._id}>
              <td className="mono">#{loan._id.slice(-8)}</td>
              <td className="mono">{String(loan.customerId).slice(-8)}</td>
              <td>{loan.items.map((i) => i.title).join(', ')}</td>
              <td>{new Date(loan.dueDate).toLocaleDateString()}</td>
              <td>${loan.total.toFixed(2)}</td>
              <td><button onClick={() => returnLoan(loan._id)}>Registrar devolución</button></td>
            </tr>
          ))}
          {loans.length === 0 && <tr><td colSpan="6" className="muted">Sin préstamos activos</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
