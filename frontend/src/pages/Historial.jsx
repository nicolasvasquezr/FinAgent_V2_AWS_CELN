import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { fmt, fmtDate, currentMonth } from '../lib/utils'
import Modal from '../components/Modal'
import TransactionForm from '../components/TransactionForm'

export default function Historial({ categories, onRefresh }) {
  const [txs, setTxs] = useState([])
  const [month, setMonth] = useState(currentMonth())
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = () => {
    setLoading(true)
    api.getTransactions({ month, category: filterCat, type: filterType })
      .then(setTxs).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [month, filterCat, filterType])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      await api.updateTransaction(editing.id, data)
      setEditing(null)
      load()
      onRefresh()
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    setDeleting(id)
    try { await api.deleteTransaction(id); load(); onRefresh() }
    catch(e) { alert(e.message) }
    finally { setDeleting(null) }
  }

  const catMap = Object.fromEntries(categories.map(c => [c.name, c]))

  const totalGastos = txs.filter(t => t.type === 'gasto').reduce((a,t) => a + t.total, 0)
  const totalIngresos = txs.filter(t => t.type === 'ingreso').reduce((a,t) => a + t.total, 0)

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>Historial</h2>
        <div style={s.filters}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={s.select} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={s.select}>
            <option value="">Todos</option>
            <option value="gasto">Gastos</option>
            <option value="ingreso">Ingresos</option>
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={s.select}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div style={s.summary}>
        <span style={{ color:'#22c55e' }}>↓ {fmt(totalIngresos)}</span>
        <span style={{ color:'#ef4444' }}>↑ {fmt(totalGastos)}</span>
        <span style={{ color: totalIngresos - totalGastos >= 0 ? '#22c55e' : '#ef4444' }}>
          Balance: {fmt(totalIngresos - totalGastos)}
        </span>
        <span style={{ color:'#8892aa' }}>{txs.length} registros</span>
      </div>

      {loading
        ? <div style={s.empty}>Cargando...</div>
        : txs.length === 0
          ? <div style={s.empty}>Sin transacciones para este período</div>
          : <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Fecha','Descripción','Categoría','Método','Monto',''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txs.map(tx => {
                    const cat = catMap[tx.category]
                    return (
                      <tr key={tx.id} style={s.tr}>
                        <td style={s.td}><span style={s.date}>{fmtDate(tx.date)}</span></td>
                        <td style={s.td}>
                          <div style={s.desc}>{tx.description}</div>
                          {tx.notes && <div style={s.notes}>{tx.notes}</div>}
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, background: (cat?.color || '#6366f1') + '20', color: cat?.color || '#6366f1' }}>
                            {cat?.icon || '💰'} {tx.category}
                          </span>
                        </td>
                        <td style={s.td}><span style={s.method}>{tx.payment_method}</span></td>
                        <td style={s.td}>
                          <span style={{ color: tx.type === 'ingreso' ? '#22c55e' : '#ef4444', fontWeight:600 }}>
                            {tx.type === 'ingreso' ? '+' : '-'}{fmt(tx.total)}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={s.actions}>
                            <button style={s.btnEdit} onClick={() => setEditing(tx)}>✏️</button>
                            <button style={s.btnDel} onClick={() => handleDelete(tx.id)}
                              disabled={deleting === tx.id}>
                              {deleting === tx.id ? '...' : '🗑️'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
      }

      {editing && (
        <Modal title="Editar transacción" onClose={() => setEditing(null)}>
          <TransactionForm
            categories={categories}
            initial={editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
            loading={saving}
          />
        </Modal>
      )}
    </div>
  )
}

const s = {
  page: { display:'flex',flexDirection:'column',gap:20 },
  topBar: { display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 },
  pageTitle: { color:'#e8edf8',fontSize:22,fontWeight:700 },
  filters: { display:'flex',gap:8,flexWrap:'wrap' },
  select: { background:'#161c2e',border:'1px solid #ffffff18',borderRadius:8,padding:'8px 12px',color:'#e8edf8',fontSize:13 },
  summary: { display:'flex',gap:24,flexWrap:'wrap',background:'#0e1220',border:'1px solid #ffffff10',borderRadius:10,padding:'12px 20px',fontSize:14,fontWeight:600 },
  empty: { color:'#8892aa',textAlign:'center',padding:60,fontSize:14 },
  tableWrap: { overflowX:'auto',borderRadius:12,border:'1px solid #ffffff10' },
  table: { width:'100%',borderCollapse:'collapse' },
  th: { padding:'12px 16px',textAlign:'left',fontSize:12,color:'#8892aa',fontWeight:600,background:'#0e1220',borderBottom:'1px solid #ffffff10' },
  tr: { borderBottom:'1px solid #ffffff08' },
  td: { padding:'12px 16px',fontSize:13,color:'#e8edf8',verticalAlign:'middle',background:'#080b12' },
  date: { color:'#8892aa',whiteSpace:'nowrap' },
  desc: { fontWeight:500 },
  notes: { color:'#8892aa',fontSize:12,marginTop:2 },
  badge: { display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:500 },
  method: { color:'#8892aa',fontSize:12 },
  actions: { display:'flex',gap:6 },
  btnEdit: { background:'none',border:'none',cursor:'pointer',fontSize:15,padding:4,opacity:.7 },
  btnDel: { background:'none',border:'none',cursor:'pointer',fontSize:15,padding:4,opacity:.7 },
}
