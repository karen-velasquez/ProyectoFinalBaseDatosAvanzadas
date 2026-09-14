import { useState } from 'react';
import VideosPage from './pages/VideosPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import RentalsPage from './pages/RentalsPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import './App.css';

const TABS = [
  { id: 'videos', label: 'Películas', component: VideosPage },
  { id: 'customers', label: 'Clientes', component: CustomersPage },
  { id: 'rentals', label: 'Rentar', component: RentalsPage },
  { id: 'loans', label: 'Préstamos activos', component: LoansPage },
  { id: 'settings', label: 'Tarifas', component: SettingsPage }
];

export default function App() {
  const [tab, setTab] = useState('videos');
  const Active = TABS.find((t) => t.id === tab).component;

  return (
    <div className="shell">
      <header className="shell-header">
        <h1>🎬 Club de Videos</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="shell-main">
        <Active />
      </main>
    </div>
  );
}
