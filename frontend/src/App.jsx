import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import SemanaTab from './components/Semana/SemanaTab';
import TrabajadoresTab from './components/Trabajadores/TrabajadoresTab';
import ReporteTab from './components/Reporte/ReporteTab';
import ImportarModal from './components/Importar/ImportarModal';
import { getTrabajadores, getRamas, getRegistros } from './api';
import { getSemanaKey } from './utils/week';

const TABS = [
  { id: 'semana', label: '📅 Semana' },
  { id: 'trabajadores', label: '👷 Trabajadores' },
  { id: 'reporte', label: '📊 Reporte' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('semana');
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [trabajadores, setTrabajadores] = useState([]);
  const [ramas, setRamas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [importarOpen, setImportarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const semanaKey = getSemanaKey(semanaOffset);

  const loadBase = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([getTrabajadores(), getRamas()]);
      setTrabajadores(t);
      setRamas(r);
    } catch (e) {
      console.error('Error loading base data', e);
    }
  }, []);

  const loadRegistros = useCallback(async () => {
    try {
      const r = await getRegistros(semanaKey);
      setRegistros(r);
    } catch (e) {
      console.error('Error loading registros', e);
    }
  }, [semanaKey]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBase(), loadRegistros()]).finally(() => setLoading(false));
  }, [loadBase, loadRegistros]);

  const refresh = useCallback(() => {
    loadBase();
    loadRegistros();
  }, [loadBase, loadRegistros]);

  const refreshRegistros = useCallback(() => loadRegistros(), [loadRegistros]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-dim)' }}>
        Cargando…
      </div>
    );
  }

  return (
    <>
      <Header onImportar={() => setImportarOpen(true)} />

      <div className="container">
        <nav className="tabs">
          {TABS.map(t => (
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
            <SummaryCards
              trabajadores={trabajadores}
              registros={registros}
            />
            <SemanaTab
              trabajadores={trabajadores}
              ramas={ramas}
              registros={registros}
              semanaKey={semanaKey}
              semanaOffset={semanaOffset}
              setSemanaOffset={setSemanaOffset}
              onRefresh={refreshRegistros}
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
