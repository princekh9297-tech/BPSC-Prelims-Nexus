'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_ID = String(process.env.ADMIN_ID || 'ADMIN').trim().toUpperCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'BPN@ADMIN2026');
const SESSION_DAYS = 30;
const APP_HTML = path.join(__dirname, 'protected', 'app.html');

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function jsonError(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hex] = String(stored || '').split(':');
    if (!salt || !hex) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function randomStudentId() {
  return `BPN-${crypto.randomInt(1000, 10000)}`;
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.cookie('bpn_session', token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
}

function clearSessionCookie(req, res) {
  const secure = req.secure || process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.clearCookie('bpn_session', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/'
  });
}

// CORS is only needed by the standalone HTML. The deployed app itself is same-origin.
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  const allowed = origin === 'null' ||
    origin === 'https://bpsc-prelims-nexus-auth.onrender.com' ||
    origin === '';

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

async function getSession(req) {
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const token = bearer || req.cookies.bpn_session;
  if (!token) return null;

  const result = await pool.query(
    `SELECT token, student_id, role, expires_at
       FROM sessions
      WHERE token = $1 AND expires_at > NOW()
      LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

app.use(async (req, res, next) => {
  try {
    req.session = await getSession(req);
    next();
  } catch (err) {
    next(err);
  }
});

function requireStudent(req, res, next) {
  if (req.session?.role === 'student') return next();
  return jsonError(res, 401, 'Student login required.');
}

function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin') return next();
  return jsonError(res, 401, 'Admin login required.');
}

function expiryIsValid(expiry) {
  if (!expiry) return true;
  // Treat the date as valid through the end of that calendar day in IST.
  const end = new Date(`${String(expiry).slice(0, 10)}T23:59:59+05:30`);
  return !Number.isNaN(end.getTime()) && end >= new Date();
}

function loginPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>BPSC Prelims Nexus — Login</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#07090b;color:#f6f3ea;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:min(460px,100%);padding:30px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:#111417;box-shadow:0 30px 90px rgba(0,0,0,.55)}.brand{display:flex;gap:13px;align-items:center;margin-bottom:25px}.mark{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;background:#c9a85b;color:#111;font-weight:1000}.brand h1{margin:0;font-size:23px}.sub{margin-top:5px;color:#87909a;font-size:10px;letter-spacing:.14em}.label{display:block;margin:13px 0 6px;color:#b8b9b5;font-size:11px;font-weight:800}.input{width:100%;padding:14px;border-radius:11px;border:1px solid #34383d;background:#0d1012;color:#fff;outline:0}.input:focus{border-color:#c9a85b}.enter{width:100%;margin-top:17px;padding:14px;border:0;border-radius:11px;background:#c9a85b;color:#111;font-weight:950;cursor:pointer}.enter:disabled{opacity:.55;cursor:wait}.admin{width:100%;margin-top:10px;padding:12px;border:1px solid rgba(201,168,91,.42);border-radius:11px;background:transparent;color:#d8bb77;font-weight:850;cursor:pointer}.msg{min-height:18px;margin-top:10px;text-align:center;color:#ff7188;font-size:12px}.note{margin-top:17px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07);color:#727a83;font-size:9px;line-height:1.55;text-align:center}.overlay{position:fixed;inset:0;z-index:20;display:none;place-items:center;padding:18px;background:rgba(0,0,0,.86);backdrop-filter:blur(12px)}.overlay.show{display:grid}.box{width:min(460px,100%);padding:25px;border-radius:21px;background:#101316;border:1px solid rgba(201,168,91,.4)}.actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.actions button{padding:12px;border-radius:10px;font-weight:900;cursor:pointer}.cancel{background:#1b1f23;color:#fff;border:1px solid #42474c}.go{background:#c9a85b;color:#111;border:0}.manager{width:min(1100px,100%);max-height:92vh;overflow:auto;padding:25px;border-radius:21px;background:#101316;border:1px solid rgba(201,168,91,.4)}.top{display:flex;justify-content:space-between;align-items:center;gap:10px}.close{background:#1b1f23;color:#fff;border:1px solid #42474c;padding:11px;border-radius:10px}.form{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:9px;margin-top:14px}.form input{padding:12px;border-radius:9px;border:1px solid #34383d;background:#0d1012;color:#fff}.generate{padding:12px 14px;border:0;border-radius:9px;background:#c9a85b;color:#111;font-weight:900;cursor:pointer}.panel{margin-top:17px;padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:#0d1012}.created{display:none;margin-top:12px;padding:13px;border-radius:10px;background:#171b1e;color:#e8e4d8}.tablewrap{overflow:auto;margin-top:10px}.table{width:100%;border-collapse:collapse;min-width:820px}.table th,.table td{padding:9px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px}.table th{color:#9da3a8}.action{padding:7px 10px;border:1px solid #454a4f;border-radius:8px;background:#1b1f23;color:#fff;cursor:pointer}@media(max-width:700px){.form{grid-template-columns:1fr 1fr}.generate{grid-column:1/-1}}
</style></head>
<body>
<main class="card"><div class="brand"><div class="mark">BN</div><div><h1>BPSC Prelims Nexus</h1><div class="sub">AUTHORISED STUDENT ACCESS</div></div></div>
<form id="loginForm"><label class="label">Student ID</label><input class="input" id="sid" autocomplete="username" placeholder="Enter Student ID" required>
<label class="label">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" placeholder="Enter Password" required>
<button class="enter" id="login" type="submit">ENTER BPSC PRELIMS NEXUS</button><div class="msg" id="msg"></div></form>
<button class="admin" id="admin" type="button">⚙ ADMIN / STUDENT ACCOUNT MANAGER</button>
<div class="note">Authentication and student data are handled by the BPSC Nexus server.</div></main>
<div class="overlay" id="adminOverlay"><div class="box"><h2>Admin Login</h2><input class="input" id="aid" autocomplete="username" placeholder="Admin ID"><br><br><input class="input" id="apw" type="password" autocomplete="current-password" placeholder="Admin Password"><div class="actions"><button class="cancel" id="cancel" type="button">Cancel</button><button class="go" id="open" type="button">Open Admin</button></div><div class="msg" id="amsg"></div></div></div>
<div class="overlay" id="managerOverlay"><div class="manager"><div class="top"><div><h2>Student Account Manager</h2><div style="color:#858c92;font-size:11px">Server-side student accounts</div></div><button class="close" id="mclose" type="button">Close Admin</button></div>
<div class="panel"><b>Create Student Account</b><div class="form"><input id="name" placeholder="Student name"><input id="expiry" type="date"><input id="custom" placeholder="Student ID (optional)"><button class="generate" id="generate" type="button">Generate Account</button></div><div class="created" id="created"></div></div>
<div class="panel"><b>Student Accounts</b><div class="tablewrap"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Password</th><th>Expiry</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div></div>
</div></div>
<script>
const api=async(path,opt={})=>{const r=await fetch('/api'+path,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Request failed');return d};
const $=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('msg').textContent='Checking credentials…';$('login').disabled=true;try{const d=await api('/login',{method:'POST',body:JSON.stringify({studentId:$('sid').value.trim(),password:$('pw').value})});try{localStorage.setItem('BPN_SERVER_SESSION_TOKEN_V1',d.token||'')}catch{}location.replace('/app')}catch(e){$('msg').textContent=e.message;$('login').disabled=false}});
$('admin').onclick=()=>{$('adminOverlay').classList.add('show');$('aid').focus()};$('cancel').onclick=()=>$('adminOverlay').classList.remove('show');
$('open').onclick=async()=>{try{await api('/admin/login',{method:'POST',body:JSON.stringify({id:$('aid').value.trim(),password:$('apw').value})});$('adminOverlay').classList.remove('show');await renderAccounts();$('managerOverlay').classList.add('show')}catch(e){$('amsg').textContent=e.message}};
async function renderAccounts(){try{const d=await api('/admin/students');$('rows').innerHTML=(d.students||[]).map(function(a){return '<tr><td>'+esc(a.studentId)+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.password)+'</td><td>'+esc(a.expiry||'No expiry')+'</td><td>'+esc(a.status)+'</td><td>'+esc(a.lastLogin||'Never')+'</td><td><button class="action" onclick="toggleStudent(\''+encodeURIComponent(a.studentId)+'\')">'+(a.status==='blocked'?'Activate':'Block')+'</button></td></tr>'}).join('')||'<tr><td colspan="7">No student accounts yet.</td></tr>'}catch(e){$('rows').innerHTML='<tr><td colspan="7">'+esc(e.message)+'</td></tr>'}}
window.toggleStudent=async id=>{try{await api('/admin/students/'+id+'/toggle',{method:'POST'});await renderAccounts()}catch(e){alert(e.message)}};
$('generate').onclick=async()=>{try{const d=await api('/admin/students',{method:'POST',body:JSON.stringify({name:$('name').value.trim(),expiry:$('expiry').value,studentId:$('custom').value.trim()})});$('created').style.display='block';$('created').innerHTML='<b>Account Created</b><br>Student ID: <strong>'+esc(d.studentId)+'</strong><br>Password: <strong>'+esc(d.password)+'</strong>';$('name').value='';$('custom').value='';await renderAccounts()}catch(e){alert(e.message)}};
$('mclose').onclick=async()=>{try{await api('/logout',{method:'POST'})}finally{location.replace('/')}};
</script></body></html>`;
}

app.get('/', (req, res) => {
  if (req.session?.role === 'student') return res.redirect('/app');
  res.type('html').send(loginPage());
});

app.get('/admin', (req, res) => res.type('html').send(loginPage()));

app.get('/app', (req, res) => {
  if (req.session?.role !== 'student') return res.redirect('/');
  return res.sendFile(APP_HTML);
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'BPSC Prelims Nexus', version: '3.0-stable' }));

app.get('/api/session', (req, res) => {
  if (!req.session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, role: req.session.role, studentId: req.session.student_id || null });
});

app.get('/api/student/me', requireStudent, (req, res) => {
  res.json({ ok: true, studentId: req.session.student_id, role: 'student' });
});

app.post('/api/login', async (req, res, next) => {
  try {
    const id = String(req.body?.studentId || '').trim().toUpperCase();
    const password = String(req.body?.password || '');
    if (!id || !password) return jsonError(res, 400, 'Student ID and password are required.');

    const result = await pool.query('SELECT * FROM students WHERE student_id=$1 LIMIT 1', [id]);
    const student = result.rows[0];
    if (!student || student.status !== 'active' || !expiryIsValid(student.expiry) || !verifyPassword(password, student.password_hash)) {
      return jsonError(res, 401, 'Invalid Student ID or Password.');
    }

    // Clean only expired sessions for this student. Existing valid sessions remain valid.
    await pool.query('DELETE FROM sessions WHERE student_id=$1 AND expires_at<=NOW()', [id]);
    const token = makeToken();
    await pool.query(
      `INSERT INTO sessions(token,student_id,role,expires_at)
       VALUES($1,$2,'student',NOW()+($3 || ' days')::interval)`,
      [token, id, String(SESSION_DAYS)]
    );
    await pool.query('UPDATE students SET last_login=NOW() WHERE student_id=$1', [id]);
    setSessionCookie(req, res, token);
    return res.json({ ok: true, token, studentId: id });
  } catch (err) { next(err); }
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const id = String(req.body?.id || '').trim().toUpperCase();
    const password = String(req.body?.password || '');
    if (id !== ADMIN_ID || password !== ADMIN_PASSWORD) return jsonError(res, 401, 'Incorrect Admin ID or Password.');
    const token = makeToken();
    await pool.query(
      `INSERT INTO sessions(token,student_id,role,expires_at)
       VALUES($1,NULL,'admin',NOW()+($2 || ' days')::interval)`,
      [token, String(SESSION_DAYS)]
    );
    setSessionCookie(req, res, token);
    return res.json({ ok: true, token });
  } catch (err) { next(err); }
});

app.post('/api/logout', async (req, res, next) => {
  try {
    const auth = String(req.headers.authorization || '');
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const token = bearer || req.cookies.bpn_session;
    if (token) await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/admin/students', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT student_id,name,password_display,expiry,status,last_login FROM students ORDER BY created_at DESC`);
    res.json({ students: result.rows.map(x => ({
      studentId: x.student_id,
      name: x.name,
      password: x.password_display,
      expiry: x.expiry,
      status: x.status,
      lastLogin: x.last_login
    })) });
  } catch (err) { next(err); }
});

app.post('/api/admin/students', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim() || 'Student';
    let studentId = String(req.body?.studentId || '').trim().toUpperCase();
    const expiry = req.body?.expiry ? String(req.body.expiry).slice(0, 10) : null;
    if (!studentId) {
      do {
        studentId = randomStudentId();
        const check = await pool.query('SELECT 1 FROM students WHERE student_id=$1', [studentId]);
        if (!check.rowCount) break;
      } while (true);
    }
    const password = randomPassword();
    await pool.query(
      `INSERT INTO students(student_id,name,password_hash,password_display,expiry,status)
       VALUES($1,$2,$3,$4,$5,'active')`,
      [studentId, name, hashPassword(password), password, expiry]
    );
    res.json({ ok: true, studentId, password });
  } catch (err) {
    if (err.code === '23505') return jsonError(res, 409, 'That Student ID already exists.');
    next(err);
  }
});

app.post('/api/admin/students/:id/toggle', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || '').toUpperCase();
    const result = await pool.query(
      `UPDATE students
          SET status=CASE WHEN status='blocked' THEN 'active' ELSE 'blocked' END
        WHERE student_id=$1
      RETURNING status`,
      [id]
    );
    if (!result.rowCount) return jsonError(res, 404, 'Student not found.');
    if (result.rows[0].status === 'blocked') await pool.query('DELETE FROM sessions WHERE student_id=$1', [id]);
    res.json({ ok: true, status: result.rows[0].status });
  } catch (err) { next(err); }
});

// -------------------------
// Persistent student state
// -------------------------
app.get('/api/student/state', requireStudent, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT state,updated_at FROM student_state WHERE student_id=$1 LIMIT 1', [req.session.student_id]);
    res.json({ state: result.rowCount ? (result.rows[0].state || {}) : {}, updatedAt: result.rowCount ? result.rows[0].updated_at : null });
  } catch (err) { next(err); }
});

app.put('/api/student/state', requireStudent, async (req, res, next) => {
  try {
    const state = req.body?.state && typeof req.body.state === 'object' ? req.body.state : {};
    await pool.query(
      `INSERT INTO student_state(student_id,state,updated_at)
       VALUES($1,$2::jsonb,NOW())
       ON CONFLICT(student_id)
       DO UPDATE SET state=EXCLUDED.state,updated_at=NOW()`,
      [req.session.student_id, JSON.stringify(state)]
    );
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

app.delete('/api/student/state', requireStudent, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_state WHERE student_id=$1', [req.session.student_id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// -------------------------
// Persistent Day Planner
// -------------------------
app.get('/api/planner', requireStudent, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,planned_date,title,test_name,notes,completed,created_at,updated_at
         FROM planner_items
        WHERE student_id=$1
        ORDER BY planned_date ASC, id ASC`,
      [req.session.student_id]
    );
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

app.post('/api/planner', requireStudent, async (req, res, next) => {
  try {
    const plannedDate = String(req.body?.plannedDate || '').slice(0, 10);
    const title = String(req.body?.title || '').trim();
    const testName = String(req.body?.testName || '').trim();
    const notes = String(req.body?.notes || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return jsonError(res, 400, 'Please select a valid date.');
    if (!title) return jsonError(res, 400, 'Plan title is required.');
    const result = await pool.query(
      `INSERT INTO planner_items(student_id,planned_date,title,test_name,notes)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,planned_date,title,test_name,notes,completed,created_at,updated_at`,
      [req.session.student_id, plannedDate, title, testName, notes]
    );
    res.json({ ok: true, item: result.rows[0] });
  } catch (err) { next(err); }
});

app.patch('/api/planner/:id', requireStudent, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return jsonError(res, 400, 'Invalid planner item.');
    const result = await pool.query(
      `UPDATE planner_items
          SET completed=NOT completed,updated_at=NOW()
        WHERE id=$1 AND student_id=$2
      RETURNING id,planned_date,title,test_name,notes,completed,created_at,updated_at`,
      [id, req.session.student_id]
    );
    if (!result.rowCount) return jsonError(res, 404, 'Planner item not found.');
    res.json({ ok: true, item: result.rows[0] });
  } catch (err) { next(err); }
});

app.delete('/api/planner/:id', requireStudent, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return jsonError(res, 400, 'Invalid planner item.');
    const result = await pool.query('DELETE FROM planner_items WHERE id=$1 AND student_id=$2 RETURNING id', [id, req.session.student_id]);
    if (!result.rowCount) return jsonError(res, 404, 'Planner item not found.');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return jsonError(res, 404, 'API endpoint not found.');
  res.status(404).send('Not found.');
});

app.use((err, req, res, next) => {
  console.error('[BPN SERVER ERROR]', err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return jsonError(res, 500, 'Server error. Please retry.');
  res.status(500).send('Server error.');
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students(
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_display TEXT NOT NULL,
      expiry DATE NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_login TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY,
      student_id TEXT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','admin')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS sessions_student_idx ON sessions(student_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_state(
      student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS planner_items(
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
      planned_date DATE NOT NULL,
      title TEXT NOT NULL,
      test_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pool.query(`CREATE INDEX IF NOT EXISTS planner_student_date_idx ON planner_items(student_id, planned_date)`);
  await pool.query('DELETE FROM sessions WHERE expires_at<=NOW()');

  const missing = await pool.query('SELECT COUNT(*)::int AS count FROM students');
  console.log(`[BPN] Database ready. Students: ${missing.rows[0].count}`);
  app.listen(PORT, () => console.log(`[BPN] BPSC Prelims Nexus server listening on ${PORT}`));
}

process.on('SIGTERM', async () => { try { await pool.end(); } finally { process.exit(0); } });
process.on('SIGINT', async () => { try { await pool.end(); } finally { process.exit(0); } });

init().catch(err => {
  console.error('[BPN] Database initialization failed:', err);
  process.exit(1);
});
