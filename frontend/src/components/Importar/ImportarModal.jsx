import React, { useState, useCallback } from 'react';
import { parseWhatsapp, applyWhatsapp } from '../../api';
import ParsePreview from './ParsePreview';
import { formatSemana } from '../../utils/week';

const PLACEHOLDER = `Ejemplos de formatos aceptados:

Juan García | lun 1 mar 1 mie 0.5 jue 1 vie 1 sab 0
Pedro López | días 5 | anticipo 200
Luis Martínez | días: 5.5 | extra 100 | nota: trabajó sábado

Juan trabajó lunes martes y miércoles, anticipo 300
María: días 4, extra 50`;

export default function ImportarModal({ open, onClose, trabajadores, semanaKey, onApplied }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [step, setStep] = useState('input'); // 'input' | 'preview'
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(null);

  const reset = () => {
    setText('');
    setRows(null);
    setSelected(new Set());
    setStep('input');
    setApplied(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleParse = useCallback(async () => {
    if (!text.trim()) return alert('Pega el texto del WhatsApp primero.');
    setLoading(true);
    try {
      const result = await parseWhatsapp(text, semanaKey);
      setRows(result);
      // Auto-select valid rows
      const validIndices = result.filter(r => !r.error && Object.keys(r.dias).length > 0).map(r => r.lineIndex);
      setSelected(new Set(validIndices));
      setStep('preview');
    } catch (e) {
      alert('Error al analizar: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [text, semanaKey]);

  const handleApply = useCallback(async () => {
    const toApply = rows.filter(r => selected.has(r.lineIndex) && !r.error);
    if (toApply.length === 0) return alert('No hay filas seleccionadas para importar.');
    setLoading(true);
    try {
      const result = await applyWhatsapp(semanaKey, toApply);
      setApplied(result.applied);
      onApplied();
    } catch (e) {
      alert('Error al aplicar: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [rows, selected, semanaKey, onApplied]);

  const toggleRow = (lineIndex) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(lineIndex)) next.delete(lineIndex); else next.add(lineIndex);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">💬 Importar desde WhatsApp</div>
          <button className="btn btn-icon btn-outline" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
            <span style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              background: step === 'input' ? 'var(--gold-dim)' : 'var(--surface2)',
              color: step === 'input' ? 'var(--gold)' : 'var(--text-muted)',
              border: `1px solid ${step === 'input' ? 'var(--gold)' : 'var(--border)'}`,
            }}>
              1 · Pegar texto
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
            <span style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              background: step === 'preview' ? 'var(--gold-dim)' : 'var(--surface2)',
              color: step === 'preview' ? 'var(--gold)' : 'var(--text-muted)',
              border: `1px solid ${step === 'preview' ? 'var(--gold)' : 'var(--border)'}`,
            }}>
              2 · Revisar y confirmar
            </span>
          </div>

          {/* Semana */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
            Semana: <strong style={{ color: 'var(--gold)' }}>{formatSemana(semanaKey)}</strong>
          </div>

          {step === 'input' && (
            <>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Texto del chat o lista de WhatsApp</label>
                <textarea
                  className="wa-textarea"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={10}
                />
              </div>
              <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
                <strong>Formatos soportados:</strong> días individuales (lun 1 mar 0.5…), días totales (días 5), lenguaje natural ("Juan trabajó lunes y martes").
                Puedes incluir <code>extra: $100</code> y <code>anticipo: $200</code>.
              </div>
            </>
          )}

          {step === 'preview' && rows && (
            <>
              {applied !== null ? (
                <div className="alert alert-success">
                  ✅ Se importaron <strong>{applied}</strong> registro(s) exitosamente.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-dim)' }}>
                      Selecciona las filas a importar (click para activar/desactivar)
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelected(new Set(rows.filter(r => !r.error).map(r => r.lineIndex)))}>
                        Todo
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelected(new Set())}>
                        Nada
                      </button>
                    </div>
                  </div>
                  <ParsePreview rows={rows} onToggle={toggleRow} selected={selected} />
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 'input' && (
            <>
              <button className="btn btn-outline" onClick={handleClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleParse} disabled={loading || !text.trim()}>
                {loading ? 'Analizando…' : 'Analizar →'}
              </button>
            </>
          )}
          {step === 'preview' && applied === null && (
            <>
              <button className="btn btn-outline" onClick={() => setStep('input')}>← Volver</button>
              <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-dim)', alignSelf: 'center', textAlign: 'center' }}>
                {selected.size} seleccionado(s)
              </span>
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={loading || selected.size === 0}
              >
                {loading ? 'Aplicando…' : `Aplicar ${selected.size} registro(s)`}
              </button>
            </>
          )}
          {step === 'preview' && applied !== null && (
            <>
              <button className="btn btn-outline" onClick={reset}>Importar más</button>
              <button className="btn btn-primary" onClick={handleClose}>Cerrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
