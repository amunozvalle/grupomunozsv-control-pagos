import React, { useState } from 'react';
import SemanaTable from './SemanaTable';
import PagoModal from './PagoModal';
import CompartirModal from './CompartirModal';
import RecordatorioModal from './RecordatorioModal';
import { formatSemana } from '../../utils/week';

export default function SemanaTab({ trabajadores, ramas, registros, semanaKey, semanaOffset, setSemanaOffset, onRefresh }) {
  const [filtroRama, setFiltroRama] = useState('todos');
  const [editando, setEditando] = useState(null);
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [recordatorioOpen, setRecordatorioOpen] = useState(false);

  const ramasFiltradas = filtroRama === 'todos'
    ? trabajadores
    : trabajadores.filter((t) => t.rama === filtroRama);

  const recordMap = Object.fromEntries(registros.map((r) => [r.trabajador_id, r]));

  return (
    <>
      <div className="section-header">
        <span className="section-title">Semana</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setRecordatorioOpen(true)}>
            Recordatorio Sábado
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setCompartirOpen(true)}>
            Compartir timesheets
          </button>
          <div className="week-nav">
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o - 1)}>‹</button>
            <span className="week-label">{formatSemana(semanaKey)}</span>
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o + 1)}>›</button>
            {semanaOffset !== 0 && (
              <button className="btn btn-sm btn-outline" onClick={() => setSemanaOffset(0)}>Hoy</button>
            )}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-chip${filtroRama === 'todos' ? ' active' : ''}`}
          onClick={() => setFiltroRama('todos')}
        >
          Todos
        </button>
        {ramas.map((rama) => (
          <button
            key={rama.id}
            className={`filter-chip${filtroRama === rama.id ? ' active' : ''}`}
            onClick={() => setFiltroRama(rama.id)}
          >
            <span className="dot" style={{ background: rama.color }} />
            {rama.emoji} {rama.label}
          </button>
        ))}
      </div>

      <SemanaTable
        trabajadores={ramasFiltradas}
        ramas={ramas}
        recordMap={recordMap}
        semanaKey={semanaKey}
        onEdit={(t) => setEditando({ trabajador: t, record: recordMap[t.id] || null })}
        onRefresh={onRefresh}
      />

      {compartirOpen && (
        <CompartirModal
          semanaKey={semanaKey}
          onClose={() => setCompartirOpen(false)}
        />
      )}

      {recordatorioOpen && (
        <RecordatorioModal
          trabajadores={trabajadores}
          registros={registros}
          semanaKey={semanaKey}
          onClose={() => setRecordatorioOpen(false)}
        />
      )}

      {editando && (
        <PagoModal
          trabajador={editando.trabajador}
          record={editando.record}
          semanaKey={semanaKey}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onRefresh(); }}
        />
      )}
    </>
  );
}
