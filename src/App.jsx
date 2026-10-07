import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_DATA, DEFAULT_SECTIONS } from './defaultData'

// ข้อมูลที่ผู้เล่นเห็น = public/rules.json (แก้ในรีโปแล้ว push) | แบบร่างของแอดมิน = localStorage (เห็นเฉพาะแอดมิน)
const DK = 'bestcity_draft_v6', UK = 'bestcity_users', SK = 'bestcity_session', TK = 'bestcity_theme'
const uid = () => Math.random().toString(36).slice(2, 9)
const today = () => new Date().toISOString().slice(0, 10)
const load = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f } catch { return f } }
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('')
const norm = (d) => {
  const secs = d.sections?.length ? d.sections : DEFAULT_SECTIONS
  return { ...DEFAULT_DATA, ...d, sections: secs, categories: (d.categories || []).map((c) => ({
    ...c, sec: secs.some((s) => s.id === c.sec) ? c.sec : secs[0].id,
    groups: c.groups || [{ id: uid(), title: 'รายการ', items: c.items || [] }] })) }
}
const DEF = norm(DEFAULT_DATA)
const parseHash = () => { const p = location.hash.replace(/^#\/?/, '').split('/'); return { route: p[0] || 'home', cat: p[1] || '', grp: p[2] || '' } }
const Rich = ({ t }) => t.split('**').map((s, i) => (i % 2 ? <b key={i} className="red">{s}</b> : s))
const num = (e) => Number(String(e.target.value).replace(/,/g, '')) || 0
const fmt = (n) => Math.round(n).toLocaleString('en-US')

function Modal({ title, fields, initial, onSave, onClose, error }) {
  const [v, setV] = useState(initial || {})
  const set = (k, val) => setV({ ...v, [k]: val })
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave(v) }}>
        <h3>{title}</h3>
        {fields.map((f) => (
          <label key={f.k}>{f.label}
            {f.opts ? <select value={v[f.k] || f.opts[0][0]} onChange={(e) => set(f.k, e.target.value)}>
                {f.opts.map(([val, lb]) => <option key={val} value={val}>{lb}</option>)}</select>
              : f.area ? <textarea rows={3} value={v[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} />
              : <input type={f.type || 'text'} required={f.req} value={v[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} />}
          </label>
        ))}
        {error && <p className="err">{error}</p>}
        <div className="row end"><button type="button" className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn">บันทึก</button></div>
      </form>
    </div>
  )
}

function Row({ it, path, href, admin, onEdit, onDel }) {
  const lines = (it.detail || '').split('\n')
  const tl = lines.find((l) => l.startsWith('ประเภทคดี:'))
  const detail = lines.filter((l) => l !== tl).join('\n')
  const tag = tl ? tl.replace('ประเภทคดี:', '').trim() : ''
  return (
    <div className={'item' + (!it.title && !detail ? ' pen-only' : '')}>
      <div className="item-main">
        {path && <small className="path"><a href={href}>{path}</a></small>}
        {(it.title || tag) && <b>{it.title && <Rich t={it.title} />}{tag && <span className={'tag' + (tag.includes('แดง') ? ' red-tag' : '')}>{tag}</span>}</b>}
        {detail && <p><Rich t={detail} /></p>}
      </div>
      {it.penalty && <div className="penalty">{it.penalty}</div>}
      {admin && <div className="acts"><a onClick={onEdit}>✏️</a><a onClick={onDel}>🗑️</a></div>}
    </div>
  )
}

function Calc() {
  const [fine, setFine] = useState(50000), [mult, setMult] = useState(1)
  const [mins, setMins] = useState(30), [red, setRed] = useState(false)
  const [ic, setIc] = useState(100000)
  const th = red ? 30 : 5, pay = Math.max(0, mins - th)
  return (
    <div className="calc">
      <section className="panel"><div className="panel-h"><h3>💸 ค่าปรับ x ตัวคูณ</h3></div>
        <div className="calc-b">
          <label>ค่าปรับต้นทาง (IC)<input value={fine} onChange={(e) => setFine(num(e))} inputMode="numeric" /></label>
          <label>ตัวคูณ<select value={mult} onChange={(e) => setMult(Number(e.target.value))}>{[1, 2, 3, 5].map((m) => <option key={m} value={m}>x{m}</option>)}</select></label>
          <div className="res">ค่าปรับรวม <b className="red">{fmt(fine * mult)} IC</b></div>
        </div></section>
      <section className="panel"><div className="panel-h"><h3>⛓️ ค่าประกันตัว</h3></div>
        <div className="calc-b">
          <label>เวลาจำคุก (นาที)<input value={mins} onChange={(e) => setMins(num(e))} inputMode="numeric" /></label>
          <label>ประเภทคดี<select value={red ? 'r' : 'g'} onChange={(e) => setRed(e.target.value === 'r')}><option value="g">คดีทั่วไป (ประกันได้จนเหลือ 5 นาที)</option><option value="r">คดีแดง (ประกันได้จนเหลือ 30 นาที)</option></select></label>
          <div className="res">ประกันตัวได้ <b>{pay} นาที</b> = <b className="red">{fmt(pay * 500)} IC</b>{pay === 0 && <small className="muted"> (เวลาไม่พอให้ประกัน)</small>}</div>
        </div></section>
      <section className="panel"><div className="panel-h"><h3>🔁 แปลงบิลจำคุก (1 นาที = 500 IC)</h3></div>
        <div className="calc-b">
          <label>จำนวนเงิน (IC)<input value={ic} onChange={(e) => setIc(num(e))} inputMode="numeric" /></label>
          <div className="res">เท่ากับจำคุก <b>{(ic / 500).toLocaleString('en-US', { maximumFractionDigits: 1 })} นาที</b></div>
        </div></section>
    </div>
  )
}

export default function App() {
  const [pub, setPub] = useState(null)
  const [draft, setDraft] = useState(() => { const d = load(DK, null); return d ? norm(d) : null })
  const [theme, setTheme] = useState(() => localStorage.getItem(TK) || 'dark')
  const [admin, setAdmin] = useState(() => localStorage.getItem(SK))
  const [hash, setHash] = useState(parseHash)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')
  const [bar, setBar] = useState(false)
  const [nav, setNav] = useState(false)
  const [toast, setToast] = useState('')
  const [top, setTop] = useState(false)
  const file = useRef()

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(TK, theme) }, [theme])
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'rules.json?t=' + Date.now()).then((r) => r.json()).then((d) => setPub(norm(d))).catch(() => setPub(DEF))
    const f = () => { setHash(parseHash()); setQ(''); setNav(false) }
    const s = () => setTop(window.scrollY > 500)
    window.addEventListener('hashchange', f); window.addEventListener('scroll', s)
    return () => { window.removeEventListener('hashchange', f); window.removeEventListener('scroll', s) }
  }, [])
  useEffect(() => {
    if (hash.grp) { const t = setTimeout(() => document.getElementById('g-' + hash.grp)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); return () => clearTimeout(t) }
    window.scrollTo(0, 0)
  }, [hash, pub])
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 1800) }

  const data = (admin && draft) || pub || DEF
  const { sections: secs, categories: cats } = data
  const sec = secs.find((s) => s.id === hash.route)
  const secCats = sec ? cats.filter((c) => c.sec === sec.id) : []
  const cat = secCats.find((c) => c.id === hash.cat) || secCats[0]
  const go = (r) => { location.hash = '#/' + r }
  const commit = (d) => { const n = { ...d, updated: today() }; setDraft(n); save(DK, n) }
  const upCat = (cid, fn) => commit({ ...data, categories: cats.map((c) => (c.id === cid ? { ...fn(c), upd: today() } : c)) })
  const upGroup = (cid, gid, fn) => upCat(cid, (c) => ({ ...c, groups: c.groups.map((x) => (x.id === gid ? fn(x) : x)) }))
  const link = (sid, cid, gid) => location.href.split('#')[0] + '#/' + [sid, cid, gid].filter(Boolean).join('/')

  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return null
    return cats.flatMap((c) => c.groups.flatMap((gr) => gr.items
      .filter((it) => [it.title, it.detail, it.penalty, c.title, gr.title].join(' ').replace(/\*\*/g, '').toLowerCase().includes(s))
      .map((it) => ({ it, c, gr }))))
  }, [q, cats])
  const dups = () => {
    const m = {}
    cats.forEach((c) => c.groups.forEach((g) => g.items.forEach((it) => {
      const k = [it.title, it.detail, it.penalty].join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
      if (k.length >= 12) (m[k] = m[k] || []).push({ c, g, it })
    })))
    return Object.entries(m).filter(([, a]) => a.length > 1)
  }

  const auth = async (mode, { user, pass }) => {
    const users = load(UK, []), h = await sha(pass)
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
  const noUsers = !load(UK, []).length
  const logout = () => { localStorage.removeItem(SK); setAdmin(null); setBar(false) }

  const saveItem = ({ cid, gid }, v) => {
    const title = (v.title || '').trim(); if (!title && !v.detail && !v.penalty) return
    const f = { title, detail: v.detail || '', penalty: v.penalty || '' }
    upGroup(cid, gid, (gr) => ({ ...gr, items: v.id ? gr.items.map((x) => (x.id === v.id ? { ...x, ...f } : x)) : [...gr.items, { id: uid(), ...f }] }))
    setModal(null)
  }
  const delItem = (cid, gid, id) => confirm('ลบรายการนี้?') && upGroup(cid, gid, (gr) => ({ ...gr, items: gr.items.filter((x) => x.id !== id) }))
  const saveGroup = (cid, v) => {
    if (!(v.title || '').trim()) return
    upCat(cid, (c) => ({ ...c, groups: v.id ? c.groups.map((x) => (x.id === v.id ? { ...x, title: v.title, note: v.note || '' } : x)) : [...c.groups, { id: uid(), title: v.title, note: v.note || '', items: [] }] }))
    setModal(null)
  }
  const delGroup = (cid, gr) => confirm(`ลบหมวดย่อย "${gr.title}" และรายการทั้งหมด?`) && upCat(cid, (c) => ({ ...c, groups: c.groups.filter((x) => x.id !== gr.id) }))
  const saveCat = (v) => {
    if (!(v.title || '').trim()) return
    const f = { title: v.title, sub: v.sub || '', icon: v.icon || '📌', sec: v.sec || secs[0].id }
    if (v.id) upCat(v.id, (c) => ({ ...c, ...f }))
    else { const n = { id: uid(), ...f, groups: [], upd: today() }; commit({ ...data, categories: [...cats, n] }); location.hash = `#/${f.sec}/${n.id}` }
    setModal(null)
  }
  const delCat = (c) => confirm(`ลบหมวด "${c.title}" ทั้งหมด?`) && commit({ ...data, categories: cats.filter((x) => x.id !== c.id) })
  const saveSec = (v) => {
    if (!(v.title || '').trim()) return
    const f = { title: v.title, icon: v.icon || '📌', desc: v.desc || '' }
    if (v.id) commit({ ...data, sections: secs.map((s) => (s.id === v.id ? { ...s, ...f } : s)) })
    else commit({ ...data, sections: [...secs, { id: uid(), ...f }] })
    setModal(null)
  }
  const delSec = (s) => {
    if (secs.length < 2 || !confirm(`ลบเมนู "${s.title}"? (หมวดในเมนูนี้จะย้ายไปเมนูแรก)`)) return
    const rest = secs.filter((x) => x.id !== s.id)
    commit({ ...data, sections: rest, categories: cats.map((c) => (c.sec === s.id ? { ...c, sec: rest[0].id } : c)) }); go('home')
  }
  const exportJSON = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    a.download = 'rules.json'; a.click(); say('ดาวน์โหลด rules.json แล้ว — นำไปแทน public/rules.json ในรีโป')
  }
  const importJSON = (e) => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.categories)) throw 0; commit(norm(d)); say('นำเข้าข้อมูลเป็นแบบร่างแล้ว') } catch { alert('ไฟล์ JSON ไม่ถูกต้อง') } }
    r.readAsText(f); e.target.value = ''
  }
  const copy = (sid, cid, gid) => { navigator.clipboard?.writeText(link(sid, cid, gid)); say('คัดลอกลิงก์แล้ว') }
  const jump = (gid) => { document.getElementById('g-' + gid)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#/${sec.id}/${cat.id}/${gid}`) }

  const itemFields = [{ k: 'title', label: 'หัวข้อ (เว้นว่างได้)' }, { k: 'detail', label: 'รายละเอียด (ใส่ ** ครอบข้อความที่ต้องการให้เป็นสีแดง)', area: true }, { k: 'penalty', label: 'บทลงโทษ / ค่าปรับ (แสดงสีแดง)' }]
  const total = cat ? cat.groups.reduce((n, x) => n + x.items.length, 0) : 0
  if (!pub) return <div className="loading">⚡ กำลังโหลดกฎ...</div>

  return (
    <div className="app">
      <header className="top">
        <a className="brand" onClick={() => go('home')}>⚡ <b>{data.siteName}</b></a>
        <nav className={'links' + (nav ? ' open' : '')}>
          <a className={hash.route === 'home' ? 'on' : ''} onClick={() => go('home')}>🏠 หน้าแรก</a>
          {secs.map((s) => <a key={s.id} className={hash.route === s.id ? 'on' : ''} onClick={() => go(s.id)}>{s.icon} {s.title}</a>)}
          <a className={hash.route === 'tools' ? 'on' : ''} onClick={() => go('tools')}>🧮 คำนวณโทษ</a>
          {data.discord && <a href={data.discord} target="_blank" rel="noreferrer">💬 Discord</a>}
        </nav>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          {admin ? <button className="btn sm" onClick={() => setBar(!bar)}>⚙️ {admin}</button>
            : <button className="btn sm" onClick={() => { setErr(''); setModal({ t: 'login' }) }}>แอดมิน</button>}
          <button className="btn ghost sm burger" onClick={() => setNav(!nav)}>☰</button>
        </div>
      </header>

      {admin && draft && <div className="draft">● มีแบบร่างที่ยังไม่เผยแพร่ (ผู้เล่นยังไม่เห็น) — กด Export แล้วนำ <b>rules.json</b> ไปแทนไฟล์ <b>public/rules.json</b> ในรีโป
        <button className="btn sm" onClick={exportJSON}>⬇ Export</button>
        <button className="btn sm ghost" onClick={() => confirm('ละทิ้งแบบร่างและกลับไปใช้ข้อมูลที่เผยแพร่?') && (localStorage.removeItem(DK), setDraft(null))}>ละทิ้งแบบร่าง</button></div>}
      {admin && bar && (
        <div className="admin-bar">
          <button className="btn sm" onClick={() => setModal({ t: 'cat', v: { sec: sec?.id } })}>+ หมวดหลัก</button>
          <button className="btn sm" onClick={() => setModal({ t: 'sec' })}>+ เมนู</button>
          <button className="btn sm" onClick={() => setModal({ t: 'site' })}>ตั้งค่าเว็บ</button>
          <button className="btn sm" onClick={() => setModal({ t: 'dups' })}>🔍 หาข้อซ้ำ</button>
          <button className="btn sm" onClick={exportJSON}>⬇ Export</button>
          <button className="btn sm" onClick={() => file.current.click()}>⬆ Import</button>
          <button className="btn sm" onClick={() => { setErr(''); setModal({ t: 'signup' }) }}>+ แอดมิน</button>
          <button className="btn sm danger" onClick={() => confirm('รีเซ็ตแบบร่างเป็นข้อมูลเริ่มต้น?') && commit(DEF)}>รีเซ็ต</button>
          <button className="btn sm ghost" onClick={logout}>ออกจากระบบ</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={importJSON} />
        </div>
      )}

      {hash.route === 'home' && !results && (<>
        {data.announcement && <div className="banner">📢 {data.announcement}{data.updated && <small> · อัปเดต {data.updated}</small>}</div>}
        <section className="hero">
          <h1>{data.welcome} <span className="grad">{data.siteName}</span></h1>
          {data.heroImage && <img className="logo" src={data.heroImage} alt="" />}
          <p>{data.tagline}</p>
          <input className="search" placeholder="🔍 ค้นหากฎ คีย์เวิร์ด หรือค่าปรับ..." value={q} onChange={(e) => setQ(e.target.value)} />
        </section>
        <section className="cards">
          {secs.map((s) => (
            <a key={s.id} className="sec-card" onClick={() => go(s.id)}>
              <span className="ic">{s.icon}</span><h3>{s.title}</h3><p>{s.desc}</p>
              <small>{cats.filter((c) => c.sec === s.id).length} หมวด →</small>
            </a>
          ))}
          <a className="sec-card" onClick={() => go('tools')}><span className="ic">🧮</span><h3>คำนวณโทษ</h3><p>คิดค่าปรับ ค่าประกันตัว และแปลงบิลจำคุก</p><small>เปิดเครื่องมือ →</small></a>
        </section>
        <section className="contact">
          <h2>ช่องทางการติดต่อ</h2>
          <div className="row center">
            {data.discord ? <a className="btn" href={data.discord} target="_blank" rel="noreferrer">💬 Discord: {data.siteName}</a> : <span className="muted">ยังไม่ได้ตั้งลิงก์ Discord (ตั้งค่าเว็บ)</span>}
            {data.facebook && <a className="btn" href={data.facebook} target="_blank" rel="noreferrer">📘 Facebook: {data.siteName}</a>}
          </div>
          {data.updated && <p className="muted"><small>กฎอัปเดตล่าสุด {data.updated}</small></p>}
        </section>
      </>)}

      {(hash.route !== 'home' || results) && (
        <main className="page">
          <input className="search slim" placeholder="🔍 ค้นหากฎ คีย์เวิร์ด หรือค่าปรับ..." value={q} onChange={(e) => setQ(e.target.value)} />
          {results ? (<>
            <h2>ผลการค้นหา <span className="count">{results.length}</span></h2>
            {!results.length && <p className="muted">ไม่พบข้อมูลที่ตรงกับ “{q}”</p>}
            <section className="panel">{results.map(({ it, c, gr }) => (
              <Row key={it.id} it={it} path={`${c.title} › ${gr.title}`} href={'#/' + [c.sec, c.id, gr.id].join('/')} admin={admin}
                onEdit={() => setModal({ t: 'item', cid: c.id, gid: gr.id, v: it })} onDel={() => delItem(c.id, gr.id, it.id)} />))}</section>
          </>) : hash.route === 'tools' ? (<>
            <div className="crumb"><a onClick={() => go('home')}>หน้าแรก</a> › คำนวณโทษ</div>
            <div className="cat-head"><div><h1>🧮 เครื่องคิดเลขโทษ</h1><p className="muted">อัตราบิลจำคุก 1 นาที = 500 IC | คดีทั่วไปประกันได้จนเหลือ 5 นาที | คดีแดงประกันได้จนเหลือ 30 นาที</p></div></div>
            <Calc />
          </>) : !sec ? <p className="muted">ไม่พบหน้านี้ <a className="lnk" onClick={() => go('home')}>กลับหน้าแรก</a></p> : (<>
            <div className="crumb"><a onClick={() => go('home')}>หน้าแรก</a> › {sec.title}</div>
            <div className="cat-head">
              <div><h1>{sec.icon} {sec.title}</h1><p className="muted">{sec.desc}</p></div>
              {admin && <div className="acts"><a onClick={() => setModal({ t: 'sec', v: sec })}>✏️ แก้เมนู</a><a onClick={() => delSec(sec)}>🗑️</a></div>}
            </div>
            <div className="tabs">
              {secCats.map((c) => (
                <span key={c.id} className={'tab' + (cat?.id === c.id ? ' on' : '')}>
                  <button onClick={() => go(`${sec.id}/${c.id}`)}>{c.icon} {c.title}</button>
                  {admin && <><a onClick={() => setModal({ t: 'cat', v: c })}>✏️</a><a onClick={() => delCat(c)}>🗑️</a></>}
                </span>
              ))}
            </div>
            {cat ? (<>
              <div className="cat-head">
                <div><h2>{cat.icon} {cat.title}</h2><p className="muted">{cat.sub}{cat.upd && <small> · อัปเดตล่าสุด {cat.upd}</small>}</p></div>
                <div className="row"><span className="count">{total} รายการ</span>
                  <button className="btn ghost sm noprint" onClick={() => window.print()}>🖨️ พิมพ์/PDF</button></div>
              </div>
              <div className="cat-body">
                <div className="cat-main">
                  {cat.groups.map((gr) => (
                    <section className="panel" id={'g-' + gr.id} key={gr.id}>
                      <div className="panel-h">
                        <div><h3>{gr.title}</h3>{gr.note && <span className="note">{gr.note}</span>}</div>
                        <div className="acts">
                          <a title="คัดลอกลิงก์" className="noprint" onClick={() => copy(sec.id, cat.id, gr.id)}>🔗</a>
                          {admin && <>
                            <a onClick={() => setModal({ t: 'item', cid: cat.id, gid: gr.id })}>➕ รายการ</a>
                            <a onClick={() => setModal({ t: 'group', cid: cat.id, v: gr })}>✏️</a>
                            <a onClick={() => delGroup(cat.id, gr)}>🗑️</a></>}
                        </div>
                      </div>
                      {gr.items.map((it) => (
                        <Row key={it.id} it={it} admin={admin}
                          onEdit={() => setModal({ t: 'item', cid: cat.id, gid: gr.id, v: it })} onDel={() => delItem(cat.id, gr.id, it.id)} />))}
                      {!gr.items.length && <p className="muted pad">ยังไม่มีรายการ</p>}
                    </section>
                  ))}
                  {admin && <button className="btn" onClick={() => setModal({ t: 'group', cid: cat.id })}>+ เพิ่มหมวดย่อย</button>}
                </div>
                {cat.groups.length > 3 && <aside className="toc"><b>สารบัญ</b>{cat.groups.map((gr) => <a key={gr.id} onClick={() => jump(gr.id)}>{gr.title}</a>)}</aside>}
              </div>
            </>) : <p className="muted">เมนูนี้ยังไม่มีหมวด {admin && 'กด "+ หมวดหลัก" ในแถบแอดมิน'}</p>}
          </>)}
        </main>
      )}

      <footer>⚡ {data.siteName}<br />© {new Date().getFullYear()} {data.siteName} — FiveM Roleplay Server</footer>
      {top && <button className="totop noprint" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>}
      {toast && <div className="toast">{toast}</div>}

      {modal?.t === 'login' && <Modal title="เข้าสู่ระบบแอดมิน" error={err} onClose={() => setModal(null)}
        fields={[{ k: 'user', label: 'ชื่อผู้ใช้', req: true }, { k: 'pass', label: 'รหัสผ่าน', type: 'password', req: true }]} onSave={(v) => auth('login', v)} />}
      {modal?.t === 'signup' && <Modal title="สมัครแอดมิน" error={err} onClose={() => setModal(null)}
        fields={[{ k: 'user', label: 'ชื่อผู้ใช้', req: true }, { k: 'pass', label: 'รหัสผ่าน (6+ ตัว)', type: 'password', req: true }]} onSave={(v) => auth('signup', v)} />}
      {modal?.t === 'item' && <Modal title={modal.v ? 'แก้ไขรายการ' : 'เพิ่มรายการ'} fields={itemFields} initial={modal.v} onClose={() => setModal(null)} onSave={(v) => saveItem(modal, v)} />}
      {modal?.t === 'group' && <Modal title={modal.v ? 'แก้ไขหมวดย่อย' : 'เพิ่มหมวดย่อย'} initial={modal.v} onClose={() => setModal(null)} onSave={(v) => saveGroup(modal.cid, v)}
        fields={[{ k: 'title', label: 'ชื่อหมวดย่อย', req: true }, { k: 'note', label: 'ข้อความโทษที่หัวหมวด (สีแดง เช่น บทลงโทษ : 🟧)' }]} />}
      {modal?.t === 'cat' && <Modal title={modal.v?.id ? 'แก้ไขหมวดหลัก' : 'เพิ่มหมวดหลัก'} initial={modal.v} onClose={() => setModal(null)} onSave={saveCat}
        fields={[{ k: 'sec', label: 'อยู่ในเมนู', opts: secs.map((s) => [s.id, `${s.icon} ${s.title}`]) }, { k: 'icon', label: 'ไอคอน (อีโมจิ)' }, { k: 'title', label: 'ชื่อหมวด', req: true }, { k: 'sub', label: 'คำอธิบายสั้น' }]} />}
      {modal?.t === 'sec' && <Modal title={modal.v ? 'แก้ไขเมนู' : 'เพิ่มเมนู'} initial={modal.v} onClose={() => setModal(null)} onSave={saveSec}
        fields={[{ k: 'icon', label: 'ไอคอน (อีโมจิ)' }, { k: 'title', label: 'ชื่อเมนู (เช่น ตำรวจ)', req: true }, { k: 'desc', label: 'คำอธิบายบนการ์ดหน้าแรก', area: true }]} />}
      {modal?.t === 'site' && <Modal title="ตั้งค่าเว็บ" initial={data} onClose={() => setModal(null)}
        fields={[{ k: 'siteName', label: 'ชื่อเมือง' }, { k: 'welcome', label: 'ข้อความต้อนรับ' }, { k: 'tagline', label: 'คำโปรย' }, { k: 'announcement', label: 'ประกาศ/อัปเดตกฎล่าสุด (แสดงแบนเนอร์หน้าแรก เว้นว่าง = ซ่อน)' }, { k: 'heroImage', label: 'URL โลโก้/รูปหน้าแรก' }, { k: 'discord', label: 'ลิงก์ Discord' }, { k: 'facebook', label: 'ลิงก์ Facebook' }]}
        onSave={(v) => { commit({ ...data, ...['siteName', 'welcome', 'tagline', 'announcement', 'heroImage', 'discord', 'facebook'].reduce((o, k) => ({ ...o, [k]: v[k] || '' }), {}) }); setModal(null) }} />}
      {modal?.t === 'dups' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>🔍 ข้อความที่ซ้ำกัน ({dups().length})</h3>
            {!dups().length && <p className="muted">ไม่พบข้อความซ้ำ</p>}
            {dups().map(([k, a]) => (
              <div key={k} className="dup"><p>{k.slice(0, 140)}{k.length > 140 && '…'}</p>
                {a.map(({ c, g, it }) => <div key={it.id} className="row"><small className="muted">{c.title} › {g.title}</small><a onClick={() => delItem(c.id, g.id, it.id)}>🗑️ ลบ</a></div>)}</div>
            ))}
            <div className="row end"><button className="btn" onClick={() => setModal(null)}>ปิด</button></div>
          </div>
        </div>)}
      {!admin && noUsers && <button className="fab" onClick={() => { setErr(''); setModal({ t: 'signup' }) }}>สมัครแอดมินคนแรก</button>}
    </div>
  )
}
