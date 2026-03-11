export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export const fmtDate = (d) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export const currentMonth = () => new Date().toISOString().slice(0, 7)

export const monthLabel = (ym) => {
  if (!ym || ym === 'unknown') return ym
  const [y, m] = ym.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[parseInt(m) - 1]} ${y}`
}

export const PAYMENT_METHODS = ['Efectivo','Tarjeta débito','Tarjeta crédito','Transferencia','Nequi','Daviplata','Otro']
