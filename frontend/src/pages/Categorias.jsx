import { useState } from 'react'
import { api } from '../lib/api'

const COLORS = ['#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#64748b','#a78bfa','#0ea5e9','#22c55e','#16a34a','#94a3b8']
const ICONS  = ['💰','🛒','🍽️','🚗','🏥','🎬','👕','💻','🏠','📚','💡','🏢','📱','💵','🧑‍💻','✈️','🎮','🐾','🎁','🍺','☕','🏋️','💊','🧴','📦']

const emptyForm = { name:'', icon:'💰', color:'#6366f1' }

export default function Categorias({ categories, onRefresh }) {
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError('')
    try {
      if (editing) await api.updateCategory(editing.id, form)
      else await api.createCategory(form)
      setForm(emptyForm); setEditing(null); onRefresh()
    } catch(err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const startEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, icon: cat.icon, color: cat.color }) }
  const cancelEdit = () => { setEditing(null); setForm(emptyForm); setError('') }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar categoría? Las transacciones existentes no se borran.')) return
    try { await api.deleteCategory(id); onRefresh() }
    catch(err) { alert(err.message) }
  }

  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Categorías</h2>
      <div style={s.layout}>
        {/* Form */}
        <div style={s.formBox}>
          <h3 style={s.formTitle}>{editing ? 'Editar categoría' : 'Nueva categoría'}</h3>
          <form onSubmit={handleSave} style={s.form}>
            <label style={s.label}>Nombre *
              <input style={s.input} value={form.name} onChange={set('name')} placeholder="ej: Mascotas" required />
            </label>

            <label style={s.label}>Ícono
              <div style={s.iconGrid}>
                {ICONS.map(ic => (
                  <button key={ic} type="button"
                    style={{ ...s.iconBtn, ...(form.icon === ic ? s.iconBtnActive : {}) }}
                    onClick={() => setForm(f => ({ ...f, icon: ic }))}>
                    {ic}
                  </button>
                ))}
              </div>
            </label>

            <label style={s.label}>Color
              <div style={s.colorGrid}>
                {COLORS.map(c => (
                  <button key={c} type="button"
                    style={{ ...s.colorBtn, background: c, ...(form.color === c ? s.colorBtnActive : {}) }}
                    onClick={() => setForm(f => ({ ...f, color: c }))} />
                ))}
              </div>
            </label>

            {/* Preview */}
            <div style={s.preview}>
              <span style={{ ...s.previewBadge, background: form.color + '20', color: form.color }}>
                {form.icon} {form.name || 'Vista previa'}
              </span>
            </div>

            {error && <div style={s.error}>{error}</div>}

            <div style={s.btnRow}>
              {editing && <button type="button" style={s.btnSecondary} onClick={cancelEdit}>Cancelar</button>}
              <button type="submit" style={s.btnPrimary} disabled={saving}>
                {saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear categoría')}
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div style={s.listBox}>
          <h3 style={s.formTitle}>Categorías ({categories.length})</h3>
          <div style={s.list}>
            {categories.map(cat => (
              <div key={cat.id} style={s.catRow}>
                <span style={{ ...s.catBadge, background: cat.color + '20', color: cat.color }}>
                  {cat.icon} {cat.name}
                </span>
                <div style={s.catActions}>
                  <button style={s.actBtn} onClick={() => startEdit(cat)}>✏️</button>
                  <button style={s.actBtn} onClick={() => handleDelete(cat.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { display:'flex',flexDirection:'column',gap:24 },
  pageTitle: { color:'#e8edf8',fontSize:22,fontWeight:700 },
  layout: { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:20 },
  formBox: { background:'#0e1220',border:'1px solid #ffffff10',borderRadius:12,padding:24 },
  listBox: { background:'#0e1220',border:'1px solid #ffffff10',borderRadius:12,padding:24 },
  formTitle: { color:'#e8edf8',fontSize:15,fontWeight:600,marginBottom:16 },
  form: { display:'flex',flexDirection:'column',gap:14 },
  label: { display:'flex',flexDirection:'column',gap:8,fontSize:13,color:'#8892aa',fontWeight:500 },
  input: { background:'#161c2e',border:'1px solid #ffffff18',borderRadius:8,padding:'10px 12px',color:'#e8edf8',fontSize:14,outline:'none' },
  iconGrid: { display:'flex',flexWrap:'wrap',gap:6 },
  iconBtn: { width:36,height:36,borderRadius:8,border:'1px solid #ffffff10',background:'#161c2e',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' },
  iconBtnActive: { border:'2px solid #6366f1',background:'#6366f120' },
  colorGrid: { display:'flex',flexWrap:'wrap',gap:8 },
  colorBtn: { width:28,height:28,borderRadius:'50%',border:'2px solid transparent',cursor:'pointer' },
  colorBtnActive: { border:'2px solid #fff',transform:'scale(1.2)' },
  preview: { display:'flex',alignItems:'center',gap:8 },
  previewBadge: { padding:'6px 14px',borderRadius:20,fontSize:14,fontWeight:600 },
  error: { color:'#ef4444',fontSize:13 },
  btnRow: { display:'flex',gap:10,justifyContent:'flex-end' },
  btnPrimary: { padding:'10px 20px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' },
  btnSecondary: { padding:'10px 16px',borderRadius:8,border:'1px solid #ffffff18',background:'transparent',color:'#8892aa',fontSize:14,cursor:'pointer' },
  list: { display:'flex',flexDirection:'column',gap:8 },
  catRow: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #ffffff08' },
  catBadge: { padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:500 },
  catActions: { display:'flex',gap:4 },
  actBtn: { background:'none',border:'none',cursor:'pointer',fontSize:15,padding:4,opacity:.7 },
}
