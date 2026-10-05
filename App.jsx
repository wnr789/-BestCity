import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_DATA } from './defaultData'

const DK = 'bestcity_data', UK = 'bestcity_users', SK = 'bestcity_session', TK = 'bestcity_theme'
const uid = () => Math.random().toString(36).slice(2, 9)
const load = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f } catch { return f } }
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('')

function Modal({ title, fields, initial, onSave, onClose, error }) {
  const [v, setV] = useState(initial || {})
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSave(v) }}>
        <h3>{title}</h3>
        {fields.map((f) => (
          <label key={f.k}>{f.label}
            {f.area
              ? <textarea rows={3} value={v[f.k] || ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
              : <input type={f.type || 'text'} required={f.req} value={v[f.k] || ''}
                  onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />}
          </label>
        ))}
        {error && <p className="err">{error}</p>}
        <div className="row"><button type="button" className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn">บันทึก</button></div>
      </form>
    </div>
  )
}

function Item({ it, admin, onEdit, onDel, cat }) {
  return (
    <article className="card">
      {cat && <small className="chip">{cat}</small>}
      <h4>{it.title}</h4>
      {it.detail && <p className="detail">{it.detail}</p>}
      {it.penalty && <p className="penalty">{it.penalty}</p>}
      {admin && <div className="row sm">
        <button className="btn sm" onClick={onEdit}>แก้ไข</button>
        <button className="btn sm danger" onClick={onDel}>ลบ</button></div>}
    </article>
  )
}

export default function App() {
  const [data, setData] = useState(() => load(DK, DEFAULT_DATA))
  const [theme, setTheme] = useState(() => localStorage.getItem(TK) || 'dark')
  const [admin, setAdmin] = useState(() => localStorage.getItem(SK))
  const [active, setActive] = useState(data.categories[0]?.id)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')
  const [menu, setMenu] = useState(false)
  const file = useRef()

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(TK, theme) }, [theme])
  const commit = (d) => { setData(d); save(DK, d) }
  const cats = data.categories
  const cat = cats.find((c) => c.id === active) || cats[0]

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    return cats.flatMap((c) => c.items
      .filter((it) => [it.title, it.detail, it.penalty, c.title].join(' ').toLowerCase().includes(s))
      .map((it) => ({ it, c })))
  }, [q, cats])

  // ---- auth (ฝั่งเบราว์เซอร์เท่านั้น: ดูหมายเหตุใน README) ----
  const auth = async (mode, { user, pass }) => {
    const users = load(UK, [])
    const h = await sha(pass)
    if (mode === 'login') {
      if (!users.some((u) => u.user === user && u.h === h)) return setErr('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      localStorage.setItem(SK, user); setAdmin(user)
    } else {
      if (users.some((u) => u.user === user)) return setErr('ชื่อผู้ใช้นี้ถูกใช้แล้ว')
      if (pass.length < 6) return setErr('รหัสผ่านอย่างน้อย 6 ตัวอักษร')
      save(UK, [...users, { user, h }])
      if (!admin) { localStorage.setItem(SK, user); setAdmin(user) }
    }
    setErr(''); setModal(null)
  }
  const canSignup = !load(UK, []).length || admin
  const logout = () => { localStorage.removeItem(SK); setAdmin(null); setMenu(false) }

  // ---- CRUD ----
  const saveItem = (cid, v) => {
    const title = (v.title || '').trim(); if (!title) return
    commit({ ...data, categories: cats.map((c) => c.id !== cid ? c : {
      ...c, items: v.id
        ? c.items.map((x) => x.id === v.id ? { ...x, title, detail: v.detail || '', penalty: v.penalty || '' } : x)
        : [...c.items, { id: uid(), title, detail: v.detail || '', penalty: v.penalty || '' }] }) })
    setModal(null)
  }
  const delItem = (cid, id) => confirm('ลบรายการนี้?') &&
    commit({ ...data, categories: cats.map((c) => c.id !== cid ? c : { ...c, items: c.items.filter((x) => x.id !== id) }) })
  const saveCat = (v) => {
    if (!(v.title || '').trim()) return
    if (v.id) commit({ ...data, categories: cats.map((c) => c.id === v.id ? { ...c, title: v.title, icon: v.icon || '📌' } : c) })
    else { const n = { id: uid(), title: v.title, icon: v.icon || '📌', items: [] }; commit({ ...data, categories: [...cats, n] }); setActive(n.id) }
    setModal(null)
  }
  const delCat = (c) => { if (!confirm(`ลบหมวด "${c.title}" และรายการทั้งหมด?`)) return
    commit({ ...data, categories: cats.filter((x) => x.id !== c.id) }); setActive(cats.find((x) => x.id !== c.id)?.id) }

  // ---- backup / restore ----
  const exportJSON = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `best-city-rules-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const importJSON = (e) => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { try {
      const d = JSON.parse(r.result)
      if (!Array.isArray(d.categories)) throw 0
      commit(d); setActive(d.categories[0]?.id); alert('นำเข้าข้อมูลสำเร็จ')
    } catch { alert('ไฟล์ JSON ไม่ถูกต้อง') } }
    r.readAsText(f); e.target.value = ''
  }

  const ItemFields = [{ k: 'title', label: 'หัวข้อ', req: true }, { k: 'detail', label: 'รายละเอียด', area: true },
    { k: 'penalty', label: 'บทลงโทษ / ค่าปรับ (แสดงสีแดง)' }]

  return (
    <div className="app">
      <header className="top">
        <div className="brand">🛡️ <b>{data.siteName}</b></div>
        <div className="row">
          <button className="btn ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          {admin ? <button className="btn" onClick={() => setMenu(!menu)}>⚙️ แอดมิน: {admin}</button>
            : <button className="btn" onClick={() => { setErr(''); setModal({ t: 'login' }) }}>เข้าสู่ระบบ</button>}
        </div>
      </header>

      {admin && menu && (
        <div className="admin-bar">
          <button className="btn sm" onClick={() => setModal({ t: 'cat' })}>+ หมวดใหม่</button>
          <button className="btn sm" onClick={() => setModal({ t: 'site' })}>ตั้งค่าเว็บ</button>
          <button className="btn sm" onClick={exportJSON}>⬇ Export JSON</button>
          <button className="btn sm" onClick={() => file.current.click()}>⬆ Import JSON</button>
          <button className="btn sm" onClick={() => { setErr(''); setModal({ t: 'signup' }) }}>+ เพิ่มแอดมิน</button>
          <button className="btn sm danger" onClick={() => confirm('รีเซ็ตเป็นข้อมูลเริ่มต้น?') && commit(DEFAULT_DATA)}>รีเซ็ต</button>
          <button className="btn sm ghost" onClick={logout}>ออกจากระบบ</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={importJSON} />
        </div>
      )}

      <section className="hero" style={data.heroImage ? { backgroundImage: `linear-gradient(#1b1030cc,#1b1030cc),url(${data.heroImage})` } : null}>
        <h1>{data.siteName}</h1>
        <p>{data.tagline}</p>
        <input className="search" placeholder="🔍 ค้นหากฎ คีย์เวิร์ด หรือค่าปรับ..." value={q} onChange={(e) => setQ(e.target.value)} />
      </section>

      <div className="layout">
        <nav className="side">
          {cats.map((c) => (
            <div key={c.id} className={'nav' + (!q && cat?.id === c.id ? ' on' : '')}>
              <button onClick={() => { setActive(c.id); setQ('') }}>{c.icon} {c.title}</button>
              {admin && <span className="mini">
                <a onClick={() => setModal({ t: 'cat', v: c })}>✏️</a><a onClick={() => delCat(c)}>🗑️</a></span>}
            </div>
          ))}
        </nav>

        <main>
          {results ? (<>
            <h2>ผลการค้นหา ({results.length})</h2>
            {!results.length && <p className="muted">ไม่พบข้อมูลที่ตรงกับ “{q}”</p>}
            <div className="grid">{results.map(({ it, c }) => (
              <Item key={it.id} it={it} cat={c.title} admin={admin}
                onEdit={() => setModal({ t: 'item', cid: c.id, v: it })} onDel={() => delItem(c.id, it.id)} />))}</div>
          </>) : cat ? (<>
            <h2>{cat.icon} {cat.title}</h2>
            <div className="grid">{cat.items.map((it) => (
              <Item key={it.id} it={it} admin={admin}
                onEdit={() => setModal({ t: 'item', cid: cat.id, v: it })} onDel={() => delItem(cat.id, it.id)} />))}</div>
            {admin && <button className="btn" onClick={() => setModal({ t: 'item', cid: cat.id })}>+ เพิ่มกฎในหมวดนี้</button>}
          </>) : <p className="muted">ยังไม่มีหมวดหมู่</p>}
        </main>
      </div>
      <footer>© {data.siteName} • ข้อมูลเก็บในเบราว์เซอร์ผ่าน localStorage</footer>

      {modal?.t === 'login' && <Modal title="เข้าสู่ระบบแอดมิน" error={err} onClose={() => setModal(null)}
        fields={[{ k: 'user', label: 'ชื่อผู้ใช้', req: true }, { k: 'pass', label: 'รหัสผ่าน', type: 'password', req: true }]}
        onSave={(v) => auth('login', v)} />}
      {modal?.t === 'signup' && <Modal title="สมัครแอดมิน" error={err} onClose={() => setModal(null)}
        fields={[{ k: 'user', label: 'ชื่อผู้ใช้', req: true }, { k: 'pass', label: 'รหัสผ่าน (6+ ตัว)', type: 'password', req: true }]}
        onSave={(v) => auth('signup', v)} />}
      {modal?.t === 'item' && <Modal title={modal.v ? 'แก้ไขกฎ' : 'เพิ่มกฎ'} fields={ItemFields} initial={modal.v}
        onClose={() => setModal(null)} onSave={(v) => saveItem(modal.cid, v)} />}
      {modal?.t === 'cat' && <Modal title={modal.v ? 'แก้ไขหมวด' : 'เพิ่มหมวด'} initial={modal.v} onClose={() => setModal(null)}
        fields={[{ k: 'icon', label: 'ไอคอน (อีโมจิ)' }, { k: 'title', label: 'ชื่อหมวด', req: true }]} onSave={saveCat} />}
      {modal?.t === 'site' && <Modal title="ตั้งค่าเว็บ" initial={data} onClose={() => setModal(null)}
        fields={[{ k: 'siteName', label: 'ชื่อเมือง/เว็บ' }, { k: 'tagline', label: 'คำโปรย' }, { k: 'heroImage', label: 'URL รูปหน้าปก' }]}
        onSave={(v) => { commit({ ...data, siteName: v.siteName, tagline: v.tagline, heroImage: v.heroImage }); setModal(null) }} />}
      {!admin && canSignup && !load(UK, []).length && (
        <button className="fab" onClick={() => { setErr(''); setModal({ t: 'signup' }) }}>สมัครแอดมินคนแรก</button>)}
    </div>
  )
}
