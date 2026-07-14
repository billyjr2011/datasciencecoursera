import { NavLink, Route, Routes } from 'react-router-dom';
import Overview from './pages/Overview.jsx';
import Blocs from './pages/Blocs.jsx';
import Ucs from './pages/Ucs.jsx';
import Species from './pages/Species.jsx';
import Dbh from './pages/Dbh.jsx';
import Alerts from './pages/Alerts.jsx';
import MapPage from './pages/MapPage.jsx';
import Model from './pages/Model.jsx';

const NAV = [
  ['/', 'Aperçu', '◧'],
  ['/ucs', 'Unités de comptage', '▦'],
  ['/blocs', 'Blocs & assiettes', '◱'],
  ['/species', 'Espèces', '❦'],
  ['/dbh', 'Diamètres (DBH)', '‖'],
  ['/alerts', 'Alertes', '⚠'],
  ['/model', 'Modèle IA', '❖'],
  ['/map', 'Carte GIS', '◉'],
];

export default function App() {
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="logo">SF</div>
          <div>
            <h1>SYVIEF</h1>
            <small>Vérification d'inventaire forestier</small>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(([to, label, ic]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => (isActive ? 'on' : '')}>
              <span className="ic">{ic}</span>{label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/ucs" element={<Ucs />} />
          <Route path="/ucs/:id" element={<Ucs />} />
          <Route path="/blocs" element={<Blocs />} />
          <Route path="/species" element={<Species />} />
          <Route path="/dbh" element={<Dbh />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/model" element={<Model />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </main>
    </div>
  );
}
