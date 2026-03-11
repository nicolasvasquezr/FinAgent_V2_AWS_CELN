import { useState, useEffect, useCallback } from 'react'
import { api } from './lib/api'
import Dashboard from './pages/Dashboard.jsx'
import Historial from './pages/Historial.jsx'
import Categorias from './pages/Categorias.jsx'
import Modal from './components/Modal.jsx'
import TransactionForm from './components/TransactionForm.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'historial', label: 'Historial',  icon: '📋' },
  { id: 'categorias',label: 'Categorías', icon: '🏷️' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error)
  }, [refreshKey])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      await api.createTransaction(data)
      setShowForm(false)
      refresh()
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoIcon}>💰</span>
          <span style={s.logoText}>FinAgent</span>
        </div>
        <nav style={s.nav}>
          {NAV.map(n => (
            <button key={n.id} style={{ ...s.navBtn, ...(page === n.id ? s.navBtnActive : {}) }}
              onClick={() => setPage(n.id)}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <button style={s.addBtn} onClick={() => setShowForm(true)}>
          + Nueva transacción
        </button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {page === 'dashboard'  && <Dashboard  categories={categories} refreshKey={refreshKey} />}
        {page === 'historial'  && <Historial  categories={categories} onRefresh={refresh} />}
        {page === 'categorias' && <Categorias categories={categories} onRefresh={refresh} />}
      </main>

      {/* FAB mobile */}
      <button style={s.fab} onClick={() => setShowForm(true)}>+</button>

      {showForm && (
        <Modal title="Nueva transacción" onClose={() => setShowForm(false)}>
          <TransactionForm
            categories={categories}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            loading={saving}
          />
        </Modal>
      )}

      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#080b12; color:#e8edf8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        input, select, button { font-family: inherit; }
        input[type=month]::-webkit-calendar-picker-indicator,
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(.5); }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#080b12; }
        ::-webkit-scrollbar-thumb { background:#ffffff20; border-radius:3px; }
        @media (max-width: 640px) {
          .sidebar { display: none !important; }
          .fab { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

const s = {
  root: { display:'flex',minHeight:'100vh',background:'#080b12' },
  sidebar: { width:220,background:'#0a0d16',borderRight:'1px solid #ffffff0a',display:'flex',flexDirection:'column',padding:20,gap:8,position:'sticky',top:0,height:'100vh',flexShrink:0 },
  logo: { display:'flex',alignItems:'center',gap:10,padding:'8px 0 20px',borderBottom:'1px solid #ffffff0a',marginBottom:8 },
  logoIcon: { fontSize:24 },
  logoText: { fontSize:18,fontWeight:700,color:'#e8edf8' },
  nav: { display:'flex',flexDirection:'column',gap:4,flex:1 },
  navBtn: { display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,border:'none',background:'transparent',color:'#8892aa',fontSize:14,cursor:'pointer',textAlign:'left',width:'100%' },
  navBtnActive: { background:'#6366f120',color:'#e8edf8' },
  addBtn: { padding:'11px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',marginTop:'auto' },
  main: { flex:1,padding:32,overflowY:'auto',minWidth:0 },
  fab: { display:'none',position:'fixed',bottom:24,right:24,width:56,height:56,borderRadius:'50%',background:'#6366f1',color:'#fff',fontSize:28,border:'none',cursor:'pointer',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px #6366f140',zIndex:100 },
}