import { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.close} onClick={onClose}>✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 },
  modal: { background:'#0e1220',border:'1px solid #ffffff18',borderRadius:16,width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'auto' },
  header: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px 16px',borderBottom:'1px solid #ffffff10' },
  title: { color:'#e8edf8',fontSize:18,fontWeight:700 },
  close: { background:'none',border:'none',color:'#8892aa',fontSize:18,cursor:'pointer',padding:4,lineHeight:1 },
  body: { padding:24 },
}
