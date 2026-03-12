import { useState, useEffect, useCallback } from 'react'
import { PAYMENT_METHODS } from '../lib/utils'
import { api } from '../lib/api'

const today = () => new Date().toISOString().slice(0, 10)

const empty = {
  description: '', date: today(), total: '', currency: 'COP',
  payment_method: 'Efectivo', category: '', type: 'gasto', notes: ''
}

export default function TransactionForm({ categories, initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial ? { ...initial, total: String(initial.total) } : { ...empty })
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (initial) setForm({ ...initial, total: String(initial.total) })
    else setForm({ ...empty })
  }, [initial])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // ── AI: clasificar descripción automáticamente ──────────
  const classifyDescription = useCallback(async (description) => {
    if (!description || description.trim().length < 2) {
      setAiSuggestion(null)
      return
    }
    setAiLoading(true)
    try {
      const result = await api.classifyDescription(description.trim())
      setAiSuggestion(result)
      // Auto-seleccionar si la confianza es alta y no hay categoría seleccionada
      if (result.confidence > 50) {
        setForm(f => {
          if (!f.category || f.category === '') {
            return { ...f, category: result.category }
          }
          return f
        })
      }
    } catch (e) {
      console.error('AI classify error:', e)
      setAiSuggestion(null)
    } finally {
      setAiLoading(false)
    }
  }, [])

  // Debounce: esperar 500ms después de que el usuario deje de escribir
  useEffect(() => {
    if (form.type === 'ingreso') return
    const timer = setTimeout(() => {
      classifyDescription(form.description)
    }, 500)
    return () => clearTimeout(timer)
  }, [form.description, form.type, classifyDescription])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim() || !form.total || !form.category) return
    onSave({ ...form, total: parseFloat(form.total), notes: form.notes || '' })
  }

  const gastoCategories = categories.filter(c => !['Salario','Freelance'].includes(c.name))
  const catList = form.type === 'ingreso' ? categories : gastoCategories

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {/* Tipo */}
      <div style={s.typeRow}>
        {['gasto','ingreso'].map(t => (
          <button key={t} type="button"
            style={{ ...s.typeBtn, ...(form.type === t ? (t === 'gasto' ? s.typeBtnGasto : s.typeBtnIngreso) : {}) }}
            onClick={() => { setForm(f => ({ ...f, type: t, category: '' })); setAiSuggestion(null) }}>
            {t === 'gasto' ? '↑ Gasto' : '↓ Ingreso'}
          </button>
        ))}
      </div>

      <label style={s.label}>Descripción *
        <input style={s.input} value={form.description} onChange={set('description')}
          placeholder="ej: Mercado Éxito, Almuerzo, Uber..." required />
      </label>

      {/* AI Suggestion Badge */}
      {form.type === 'gasto' && aiSuggestion && (
        <div style={s.aiBox}>
          <div style={s.aiHeader}>
            <span style={s.aiIcon}>🤖</span>
            <span style={s.aiTitle}>IA sugiere:</span>
            {aiLoading && <span style={s.aiLoading}>analizando...</span>}
          </div>
          <div style={s.aiPredictions}>
            {aiSuggestion.all_predictions && aiSuggestion.all_predictions.map((p, i) => (
              <button key={i} type="button" style={{
                ...s.aiChip,
                ...(form.category === p.category ? s.aiChipActive : {}),
                ...(i === 0 ? s.aiChipFirst : {})
              }}
                onClick={() => setForm(f => ({ ...f, category: p.category }))}>
                {p.category} ({p.confidence}%)
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={s.row}>
        <label style={{ ...s.label, flex:1 }}>Monto *
          <input style={s.input} type="number" min="0" step="any"
            value={form.total} onChange={set('total')} placeholder="0" required />
        </label>
        <label style={{ ...s.label, width:90 }}>Moneda
          <select style={s.input} value={form.currency} onChange={set('currency')}>
            <option>COP</option><option>USD</option><option>EUR</option>
          </select>
        </label>
      </div>

      <div style={s.row}>
        <label style={{ ...s.label, flex:1 }}>Categoría *
          <select style={s.input} value={form.category} onChange={set('category')} required>
            <option value="">Seleccionar...</option>
            {catList.map(c => (
              <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ ...s.label, flex:1 }}>Fecha *
          <input style={s.input} type="date" value={form.date} onChange={set('date')} required />
        </label>
      </div>

      <label style={s.label}>Método de pago
        <select style={s.input} value={form.payment_method} onChange={set('payment_method')}>
          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
      </label>

      <label style={s.label}>Notas
        <input style={s.input} value={form.notes} onChange={set('notes')}
          placeholder="Opcional..." />
      </label>

      <div style={s.actions}>
        <button type="button" style={s.btnSecondary} onClick={onCancel}>Cancelar</button>
        <button type="submit" style={{ ...s.btnPrimary, ...(form.type === 'ingreso' ? s.btnIngreso : {}) }}
          disabled={loading}>
          {loading ? 'Guardando...' : (initial ? 'Actualizar' : `Agregar ${form.type}`)}
        </button>
      </div>
    </form>
  )
}

const s = {
  form: { display:'flex',flexDirection:'column',gap:14 },
  label: { display:'flex',flexDirection:'column',gap:6,fontSize:13,color:'#8892aa',fontWeight:500 },
  input: { background:'#161c2e',border:'1px solid #ffffff18',borderRadius:8,padding:'10px 12px',color:'#e8edf8',fontSize:14,outline:'none',width:'100%' },
  row: { display:'flex',gap:12 },
  typeRow: { display:'flex',gap:8,marginBottom:4 },
  typeBtn: { flex:1,padding:'10px',borderRadius:8,border:'1px solid #ffffff18',background:'#161c2e',color:'#8892aa',fontSize:14,fontWeight:600,cursor:'pointer' },
  typeBtnGasto: { background:'#ef444420',borderColor:'#ef4444',color:'#ef4444' },
  typeBtnIngreso: { background:'#22c55e20',borderColor:'#22c55e',color:'#22c55e' },
  actions: { display:'flex',gap:10,marginTop:4,justifyContent:'flex-end' },
  btnSecondary: { padding:'10px 20px',borderRadius:8,border:'1px solid #ffffff18',background:'transparent',color:'#8892aa',fontSize:14,cursor:'pointer' },
  btnPrimary: { padding:'10px 24px',borderRadius:8,border:'none',background:'#ef4444',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' },
  btnIngreso: { background:'#22c55e' },
  // AI styles
  aiBox: { background:'#0f172a',border:'1px solid #6366f180',borderRadius:10,padding:'10px 14px',display:'flex',flexDirection:'column',gap:8 },
  aiHeader: { display:'flex',alignItems:'center',gap:6,fontSize:12 },
  aiIcon: { fontSize:16 },
  aiTitle: { color:'#a5b4fc',fontWeight:600,fontSize:12 },
  aiLoading: { color:'#64748b',fontSize:11,marginLeft:'auto' },
  aiPredictions: { display:'flex',gap:6,flexWrap:'wrap' },
  aiChip: { padding:'5px 12px',borderRadius:20,border:'1px solid #ffffff15',background:'#1e293b',color:'#94a3b8',fontSize:12,cursor:'pointer',transition:'all 0.2s' },
  aiChipActive: { background:'#6366f130',borderColor:'#6366f1',color:'#a5b4fc' },
  aiChipFirst: { borderColor:'#6366f160' },
}