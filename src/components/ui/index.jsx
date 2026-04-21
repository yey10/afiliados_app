
export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  )
}

export function Alert({ type = 'error', message, onDismiss }) {
  if (!message) return null
  const colors = {
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
    success: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
  }
  const c = colors[type] ?? colors.error
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8
    }}>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, fontWeight: 700 }}>✕</button>
      )}
    </div>
  )
}

export function EmptyState({ text = 'Sin resultados' }) {
  return <p style={{ color: '#9ca3af', fontSize: 13, margin: '12px 0', textAlign: 'center' }}>{text}</p>
}

export function BeneficiarioForm({ onSubmit, saving }) {
  const empty = { nombre: '', apellido: '', documento: '' }
  const [form, setForm] = useState(empty)
  const [err, setErr]   = useState(null)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(null)
    const result = await onSubmit(form)
    if (result?.error) { setErr(result.error); return }
    setForm(empty)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h4 className="subheading">Agregar beneficiario</h4>
      {err && <Alert type="error" message={err} onDismiss={() => setErr(null)} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <input className="input" name="nombre" placeholder="Nombre *" value={form.nombre} onChange={handleChange} />
        <input className="input" name="apellido" placeholder="Apellido" value={form.apellido} onChange={handleChange} />
        <input className="input" name="documento" placeholder="Documento" value={form.documento} onChange={handleChange} />
        <button className="button button-primary" type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando...' : 'Agregar beneficiario'}
        </button>
      </div>
    </div>
  )
}

// useState necesita import — re-exportamos desde react para conveniencia del archivo
import { useState } from 'react'