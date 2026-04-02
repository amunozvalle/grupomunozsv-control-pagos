import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import SemanaTab from './components/Semana/SemanaTab';
import TrabajadoresTab from './components/Trabajadores/TrabajadoresTab';
import ReporteTab from './components/Reporte/ReporteTab';
import AdminsTab from './components/Admin/AdminsTab';
import CobrosTab from './components/Cobros/CobrosTab';
import LoginPage from './components/Auth/LoginPage';
import ImportarModal from './components/Importar/ImportarModal';
import {
  getTrabajadores,
  getRamas,
  getRegistros,
  getCobros,
  getSession,
  login,
  logout,
} from './api';
import { getSemanaKey } from './utils/week';

const TABS = [
  { id: 'semana', label: 'Semana' },
  { id: 'trabajadores', label: 'Trabajadores' },
  { id: 'cobros', label: 'Cobros' },
  { id: 'reporte', label: 'Reporte' },
  { id: 'admins', label: 'Admins' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('semana');
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [trabajadores, setTrabajadores] = useState([]);
  const [ramas, setRamas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [importarOpen, setImportarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const semanaKey = getSemanaKey(semanaOffset);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession();
      setCurrentAdmin(data.admin);
    } catch {
      setCurrentAdmin(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const loadBase = useCallback(async () => {
    const [t, r] = await Promise.all([getTrabajadores(), getRamas()]);
    setTrabajadores(t);
    setRamas(r);
  }, []);

  const loadRegistros = useCallback(async () => {
    const r = await getRegistros(semanaKey);
    setRegistros(r);
  }, [semanaKey]);

  const loadCobros = useCallback(async () => {
    const c = await getCobros();
    setCobros(c);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!currentAdmin) return;
    setLoading(true);
    Promise.all([loadBase(), loadRegistros(), loadCobros()]).finally(() => setLoading(false));
  }, [currentAdmin, loadBase, loadRegistros]);

  const refresh = useCallback(() => {
    loadBase();
    loadRegistros();
    loadCobros();
  }, [loadBase, loadRegistros, loadCobros]);

  const refreshRegistros = useCallback(() => loadRegistros(), [loadRegistros]);
  const refreshCobros = useCallback(() => loadCobros(), [loadCobros]);

  const handleLogin = async (credentials) => {
    const data = await login(credentials);
    setCurrentAdmin(data.admin);
    setLoading(true);
    await Promise.all([loadBase(), loadRegistros(), loadCobros()]);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentAdmin(null);
    setImportarOpen(false);
    setActiveTab('semana');
  };

  if (!authChecked || (currentAdmin && loading)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-dim)' }}>
        Cargando...
      </div>
    );
  }

  if (!currentAdmin) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      <Header
        onImportar={() => setImportarOpen(true)}
        currentAdmin={currentAdmin}
        onLogout={handleLogout}
      />

      <div className="container">
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === 'semana' && (
          <>
            <SummaryCards trabajadores={trabajadores} registros={registros} ramas={ramas} />
            <SemanaTab
              trabajadores={trabajadores}
              ramas={ramas}
              registros={registros}
              cobros={cobros}
              semanaKey={semanaKey}
              semanaOffset={semanaOffset}
              setSemanaOffset={setSemanaOffset}
              onRefresh={refresh}
              onRefreshCobros={refreshCobros}
            />
          </>
        )}

        {activeTab === 'trabajadores' && (
          <TrabajadoresTab
            trabajadores={trabajadores}
            ramas={ramas}
            onRefresh={refresh}
          />
        )}

        {activeTab === 'cobros' && <CobrosTab cobros={cobros} onRefresh={refreshCobros} />}

        {activeTab === 'reporte' && (
          <ReporteTab
            trabajadores={trabajadores}
            ramas={ramas}
            registros={registros}
            semanaKey={semanaKey}
            semanaOffset={semanaOffset}
            setSemanaOffset={setSemanaOffset}
          />
        )}

        {activeTab === 'admins' && <AdminsTab ramas={ramas} />}
      </div>

      <ImportarModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        trabajadores={trabajadores}
        semanaKey={semanaKey}
        onApplied={refreshRegistros}
      />
    </>
  );
}
