import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import { fmt, monthLabel, currentMonth } from '../lib/utils'

export default function Dashboard({ categories, refreshKey }) {
  const [month, setMonth] = useState(currentMonth())
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getStats(month).then(setStats).finally(() => setLoading(false))
  }, [month, refreshKey])

  const catMap = Object.fromEntries(categories.map(c => [c.name, c]))

  const pieData = stats
    ? Object.entries(stats.by_category || {})
        .sort((a,b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value, color: catMap[name]?.color || '#6366f1', icon: catMap[name]?.icon || '💰' }))
    : []

  const barData = stats
    ? Object.entries(stats.monthly || {})
        .sort(([a],[b]) => a.localeCompare(b))
        .slice(-6)
        .map(([ym, v]) => ({ name: monthLabel(ym), gastos: v.gastos || 0, ingresos: v.ingresos || 0 }))
    : []

  const balance = stats?.balance || 0

  return (
    <div style={s.page}>
      {/* Month selector */}
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>Dashboard</h2>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={s.monthPicker} />
      </div>

      {loading ? <div style={s.loading}>Cargando...</div> : <>
        {/* KPI Cards */}
        <div style={s.cards}>
          <Card label="Ingresos" value={fmt(stats?.ingresos || 0)} color="#22c55e" icon="↓" />
          <Card label="Gastos" value={fmt(stats?.gastos || 0)} color="#ef4444" icon="↑" />
          <Card label="Balance" value={fmt(balance)}
            color={balance >= 0 ? '#22c55e' : '#ef4444'} icon="=" />
          <Card label="Movimientos" value={stats?.count || 0} color="#6366f1" icon="#" plain />
        </div>

        <div style={s.charts}>
          {/* Pie chart */}
          <div style={s.chartBox}>
            <h3 style={s.chartTitle}>Gastos por categoría — {monthLabel(month)}</h3>
            {pieData.length === 0
              ? <div style={s.empty}>Sin gastos este mes</div>
              : <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={s.legend}>
                    {pieData.map(e => (
                      <div key={e.name} style={s.legendItem}>
                        <span style={{ ...s.legendDot, background: e.color }} />
                        <span style={s.legendName}>{e.icon} {e.name}</span>
                        <span style={s.legendVal}>{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>

          {/* Bar chart */}
          <div style={s.chartBox}>
            <h3 style={s.chartTitle}>Histórico últimos 6 meses</h3>
            {barData.length === 0
              ? <div style={s.empty}>Sin datos históricos</div>
              : <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top:8, right:8, left:8, bottom:8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                    <XAxis dataKey="name" tick={{ fill:'#8892aa', fontSize:12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'#8892aa', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background:'#0e1220', border:'1px solid #ffffff18', borderRadius:8 }} />
                    <Bar dataKey="ingresos" fill="#22c55e" radius={[4,4,0,0]} name="Ingresos" />
                    <Bar dataKey="gastos" fill="#ef4444" radius={[4,4,0,0]} name="Gastos" />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        </div>
      </>}
    </div>
  )
}

function Card({ label, value, color, icon, plain }) {
  return (
    <div style={s.card}>
      <div style={{ ...s.cardIcon, background: color + '20', color }}>{icon}</div>
      <div>
        <div style={s.cardLabel}>{label}</div>
        <div style={{ ...s.cardValue, color: plain ? '#e8edf8' : color }}>{value}</div>
      </div>
    </div>
  )
}

const s = {
  page: { display:'flex',flexDirection:'column',gap:24 },
  topBar: { display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 },
  pageTitle: { color:'#e8edf8',fontSize:22,fontWeight:700 },
  monthPicker: { background:'#161c2e',border:'1px solid #ffffff18',borderRadius:8,padding:'8px 12px',color:'#e8edf8',fontSize:14 },
  loading: { color:'#8892aa',padding:40,textAlign:'center' },
  cards: { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16 },
  card: { background:'#0e1220',border:'1px solid #ffffff10',borderRadius:12,padding:20,display:'flex',alignItems:'center',gap:16 },
  cardIcon: { width:44,height:44,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,flexShrink:0 },
  cardLabel: { color:'#8892aa',fontSize:12,marginBottom:4 },
  cardValue: { fontSize:20,fontWeight:700 },
  charts: { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:20 },
  chartBox: { background:'#0e1220',border:'1px solid #ffffff10',borderRadius:12,padding:20 },
  chartTitle: { color:'#e8edf8',fontSize:14,fontWeight:600,marginBottom:16 },
  empty: { color:'#8892aa',textAlign:'center',padding:40,fontSize:14 },
  legend: { display:'flex',flexDirection:'column',gap:8,marginTop:12 },
  legendItem: { display:'flex',alignItems:'center',gap:8,fontSize:13 },
  legendDot: { width:10,height:10,borderRadius:'50%',flexShrink:0 },
  legendName: { color:'#e8edf8',flex:1 },
  legendVal: { color:'#8892aa' },
}