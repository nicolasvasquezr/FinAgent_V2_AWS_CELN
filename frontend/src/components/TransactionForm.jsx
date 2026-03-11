import { useState, useEffect } from 'react'
import { PAYMENT_METHODS } from '../lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

const empty = {
  description: '', date: today(), total: '', currency: 'COP',
  payment_method: 'Efectivo', category: '', type: 'gasto', notes: ''
}

export default function TransactionForm({ categories, initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial ? { ...initial, total: String(initial.total) } : { ...empty })

  useEffect(() => {
    if (initial) setForm({ ...initial, total: String(initial.total) })
    else setForm({ ...empty })
  }, [initial])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

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
            onClick={() => setForm(f => ({ ...f, type: t, category: '' }))}>
            {t === 'gasto' ? '↑ Gasto' : '↓ Ingreso'}
          </button>
        ))}
      </div>

      <label style={s.label}>Descripción *
        <input style={s.input} value={form.description} onChange={set('description')}
          placeholder="ej: Mercado Éxito, Almuerzo, Uber..." required />
      </label>

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
}