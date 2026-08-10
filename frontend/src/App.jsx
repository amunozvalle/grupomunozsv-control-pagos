import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import SummaryCards from './components/SummaryCards';
import SemanaTab from './components/Semana/SemanaTab';
import TrabajadoresTab from './components/Trabajadores/TrabajadoresTab';
import ReporteTab from './components/Reporte/ReporteTab';
import ReporteAnualTab from './components/Reporte/ReporteAnualTab';
import AdminsTab from './components/Admin/AdminsTab';
import WhatsappBotPanel from './components/Admin/WhatsappBotPanel';
import CobrosTab from './components/Cobros/CobrosTab';
import LoginPage from './components/Auth/LoginPage';
import ImportarModal from './components/Importar/ImportarModal';
import {
  getTrabajadores,
  getRamas,
  getRegistros,
  getCobros,
  getMontosEntregados,
  migrarMontosEntregados,
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
  { id: 'anual', label: 'Anual' },
  { id: 'admins', label: 'Admins' },
];

const TITLES = {
  semana: 'Semana',
  trabajadores: 'Trabajadores',
  cobros: 'Cobros',
  reporte: 'Reporte',
  anual: 'Reporte Anual',
  whatsapp: 'WhatsApp Bot',
  admins: 'Administración',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('semana');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [trabajadores, setTrabajadores] = useState([]);
  const [ramas, setRamas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [montosEntregados, setMontosEntregados] = useState({});
  const [importarOpen, setImportarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const semanaKey = getSemanaKey(semanaOffset);
  const isViewer = currentAdmin?.role === 'viewer';

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

  const loadMontos = useCallback(async () => {
    try {
      const m = await getMontosEntregados();
      setMontosEntregados(m || {});
    } catch {}
  }, []);

  // Migración única: sube los montos que quedaron guardados en este navegador
  useEffect(() => {
    if (!currentAdmin) return;
    if (localStorage.getItem('gm_montos_migrados') === '1') return;
    const raw = localStorage.getItem('gm_montos_entregados');
    if (!raw) { localStorage.setItem('gm_montos_migrados', '1'); return; }
    try {
      const map = JSON.parse(raw);
      migrarMontosEntregados(map)
        .then((r) => {
          localStorage.setItem('gm_montos_migrados', '1');
          if (r?.montos) setMontosEntregados(r.montos);
        })
        .catch(() => {});
    } catch {
      localStorage.setItem('gm_montos_migrados', '1');
    }
  }, [currentAdmin]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!currentAdmin) return;
    setLoading(true);
    Promise.all([loadBase(), loadRegistros(), loadCobros(), loadMontos()]).finally(() => setLoading(false));
  }, [currentAdmin, loadBase, loadRegistros, loadCobros, loadMontos]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!currentAdmin) return;
    const interval = setInterval(() => {
      loadBase();
      loadRegistros();
      loadCobros();
      loadMontos();
    }, 30000);
    return () => clearInterval(interval);
  }, [currentAdmin, loadBase, loadRegistros, loadCobros, loadMontos]);

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
    await Promise.all([loadBase(), loadRegistros(), loadCobros(), loadMontos()]);
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
    <div className="layout">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentAdmin={currentAdmin}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <Topbar
          title={TITLES[activeTab] || 'Control de Pagos'}
          onImportar={() => setImportarOpen(true)}
          onMenu={() => setSidebarOpen(true)}
        />

        <div className="content">
          {activeTab === 'semana' && (
          <>
            <SummaryCards trabajadores={trabajadores.filter(t => t.activo !== false)} registros={registros} ramas={ramas} semanaKey={semanaKey} montosEntregados={montosEntregados} />
            <SemanaTab
              trabajadores={trabajadores.filter(t => t.activo !== false)}
              ramas={ramas}
              registros={registros}
              cobros={cobros}
              semanaKey={semanaKey}
              semanaOffset={semanaOffset}
              setSemanaOffset={setSemanaOffset}
              onRefresh={refresh}
              onRefreshCobros={refreshCobros}
              isViewer={isViewer}
            />
          </>
        )}

        {activeTab === 'trabajadores' && (
          <TrabajadoresTab
            trabajadores={trabajadores}
            ramas={ramas}
            onRefresh={refresh}
            isViewer={isViewer}
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
            montosEntregados={montosEntregados}
            onMontosChange={(periodKey, montos) =>
              setMontosEntregados(prev => ({ ...prev, [periodKey]: montos }))
            }
          />
        )}

        {activeTab === 'anual' && (
          <ReporteAnualTab
            trabajadores={trabajadores}
            ramas={ramas}
          />
        )}

        {activeTab === 'whatsapp' && <WhatsappBotPanel ramas={ramas} />}

        {activeTab === 'admins' && <AdminsTab ramas={ramas} isViewer={isViewer} />}
        </div>
      </div>

      <ImportarModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        trabajadores={trabajadores}
        semanaKey={semanaKey}
        onApplied={refreshRegistros}
      />
    </div>
  );
}
