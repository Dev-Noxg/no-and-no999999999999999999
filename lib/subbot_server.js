import http from 'http';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import config from '../config.js';
import { db, save } from './db.js';
import { handle } from '../handler.js';
import { onParticipants } from './events.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from './baileys.js';

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// قائمة البوتات الفرعية النشطة في الذاكرة
export const activeSubBots = new Map();
const pairingPending = new Map();

// تشغيل بوت فرعي لرقم هاتف محدد
export async function createSubBot(rawPhone) {
  const phone = rawPhone.replace(/\D/g, '');
  if (!phone || phone.length < 10) throw new Error('رقم الهاتف غير صالح، يجب كتابة كود الدولة مع الرقم.');

  // لو البوت شغال بالفعل
  if (activeSubBots.has(phone)) {
    const existing = activeSubBots.get(phone);
    if (existing.connected) {
      return { status: 'already_connected', message: 'هذا البوت الفرعي متصل ويعمل بالفعل!' };
    }
  }

  const sessionPath = path.join(SESSIONS_DIR, `sub_${phone}`);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  let version = [2, 3000, 1015901307];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) version = v.version;
  } catch {}

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  activeSubBots.set(phone, {
    sock,
    phone,
    connected: false,
    startedAt: Date.now(),
    sessionPath,
  });

  return new Promise((resolve, reject) => {
    let codeResolved = false;

    // مهلة 45 ثانية لتوليد الكود
    const timeout = setTimeout(() => {
      if (!codeResolved) {
        reject(new Error('انتهت مهلة استخراج كود الربط. يرجى المحاولة مرة أخرى.'));
      }
    }, 45000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // طلب كود الربط إذا لم يكن مسجلاً
      if (qr && !sock.authState.creds.registered && !codeResolved) {
        try {
          // انتظار استقرار الاتصال ثوانٍ معدودة
          await new Promise(r => setTimeout(r, 3000));
          const code = await sock.requestPairingCode(phone);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          codeResolved = true;
          clearTimeout(timeout);
          resolve({ status: 'code_ready', code: formatted, phone });
        } catch (err) {
          clearTimeout(timeout);
          reject(new Error('فشل طلب كود الربط: ' + err.message));
        }
      }

      if (connection === 'open') {
        const botData = activeSubBots.get(phone);
        if (botData) botData.connected = true;
        console.log(`🟢 [بوت فرعي] الرقم +${phone} متصل ويعمل بنجاح الآن!`);
        db.settings.subBots ??= {};
        db.settings.subBots[phone] = { connected: true, linkedAt: Date.now() };
        save();
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log(`🔴 [بوت فرعي] تم تسجيل الخروج للرقم +${phone}`);
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } catch {}
          activeSubBots.delete(phone);
          if (db.settings.subBots) {
            delete db.settings.subBots[phone];
            save();
          }
        }
      }
    });

    // معالجة الرسائل والأوامر للبوت الفرعي
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        if (!m?.message) continue;
        handle(sock, m).catch(e => console.error(`خطأ في بوت فرعي (+${phone}):`, e));
      }
    });

    // أحداث المجموعات
    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      onParticipants(sock, id, participants, action).catch(() => {});
    });
  });
}

// تشغيل كافة البوتات الفرعية المحفوظة مسبقاً عند إقلاع السيرفر
export async function reloadExistingSubBots() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const dirs = fs.readdirSync(SESSIONS_DIR).filter(d => d.startsWith('sub_'));
    for (const d of dirs) {
      const phone = d.replace('sub_', '');
      const credsFile = path.join(SESSIONS_DIR, d, 'creds.json');
      if (fs.existsSync(credsFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(credsFile, 'utf8') || '{}');
          if (raw.registered) {
            console.log(`🔄 جاري إعادة تشغيل البوت الفرعي المسجل: +${phone}...`);
            createSubBot(phone).catch(() => {});
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('خطأ في استعادة البوتات الفرعية:', e.message);
  }
}

// تصميم صفحة الويب الحديثة (Cyber Gothic / Dark Horror Web Dashboard)
function renderHtmlPage() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>منصة تنصيب البوتات الفرعية - NO &amp; NO BOT</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card: #12141f;
      --card-border: #1f2338;
      --primary: #e63946;
      --primary-glow: rgba(230, 57, 70, 0.4);
      --accent: #457b9d;
      --text: #f1faee;
      --text-dim: #8b9bb4;
      --success: #2a9d8f;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(230, 57, 70, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(69, 123, 157, 0.12) 0%, transparent 40%);
    }
    .container {
      width: 100%;
      max-width: 520px;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 35px 25px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 30px var(--primary-glow);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(230, 57, 70, 0.15);
      border: 1px solid var(--primary);
      color: #ff6b6b;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 15px;
      letter-spacing: 1px;
    }
    h1 {
      font-size: 26px;
      font-weight: 900;
      color: #fff;
      margin-bottom: 8px;
    }
    p.desc {
      font-size: 14px;
      color: var(--text-dim);
      margin-bottom: 25px;
      line-height: 1.6;
    }
    .input-group {
      text-align: right;
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-dim);
      margin-bottom: 8px;
    }
    input[type="tel"] {
      width: 100%;
      padding: 15px 18px;
      background: #0d0f18;
      border: 1px solid #282d47;
      border-radius: 14px;
      color: #fff;
      font-size: 16px;
      outline: none;
      transition: all 0.3s;
      direction: ltr;
      text-align: center;
      font-weight: 700;
      letter-spacing: 1px;
    }
    input[type="tel"]:focus {
      border-color: var(--primary);
      box-shadow: 0 0 15px var(--primary-glow);
    }
    .btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #e63946, #c1121f);
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(230, 57, 70, 0.4);
      transition: all 0.3s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(230, 57, 70, 0.6);
    }
    .btn:disabled {
      background: #33394d;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
    .code-box {
      display: none;
      margin-top: 25px;
      padding: 20px;
      background: #0a0c13;
      border: 2px dashed var(--primary);
      border-radius: 16px;
    }
    .code-title {
      font-size: 13px;
      color: var(--text-dim);
      margin-bottom: 10px;
    }
    .code-display {
      font-size: 32px;
      font-weight: 900;
      color: #ffd166;
      letter-spacing: 5px;
      font-family: monospace;
      margin-bottom: 12px;
      user-select: all;
    }
    .steps {
      margin-top: 25px;
      text-align: right;
      background: rgba(255,255,255,0.02);
      border: 1px solid #1a1e30;
      border-radius: 14px;
      padding: 16px;
      font-size: 13px;
      color: var(--text-dim);
    }
    .steps ol { padding-right: 20px; line-height: 1.8; }
    .status-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
      font-size: 13px;
      color: var(--text-dim);
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #2a9d8f; box-shadow: 0 0 10px #2a9d8f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">⚡ NO &amp; NO CLONE SYSTEM ⚡</div>
    <h1>منصة تنصيب البوتات الفرعية</h1>
    <p class="desc">اربط رقمك كبوت فرعي مستقل واستمتع بأكثر من 1190 أمراً شغالاً على رقمك الخاص 24/7 مجاناً!</p>

    <div class="input-group">
      <label>📱 رقم هاتفك (بالصيغة الدولية مع كود الدولة):</label>
      <input type="tel" id="phone" placeholder="مثال: 201012345678" required>
    </div>

    <button class="btn" id="submitBtn" onclick="requestPairing()">الحصول على كود الربط الفوري 🚀</button>

    <div class="code-box" id="codeBox">
      <div class="code-title">🔑 كود ربط الواتساب الخاص برقمك:</div>
      <div class="code-display" id="codeDisplay">----</div>
      <p style="font-size: 12px; color: #a8dadc;">اضغط على الكود لنسخه ثم افتح واتساب فوراً</p>
    </div>

    <div class="steps">
      <strong style="color: #fff;">📌 خطوات تفعيل البوت على رقمك:</strong>
      <ol>
        <li>افتح تطبيق واتساب على هاتفك.</li>
        <li>توجه إلى: <strong>الإعدادات > الأجهزة المرتبطة</strong>.</li>
        <li>اختر: <strong>ربط جهاز > الربط برقم الهاتف بدلاً من ذلك</strong>.</li>
        <li>أدخل الكود الموضح بالأعلى وسيتم تفعيل البوت على رقمك فوراً!</li>
      </ol>
    </div>

    <div class="status-badge">
      <div class="dot"></div>
      <span>السيرفر متصل ويعمل بكامل كفاءته</span>
    </div>
  </div>

  <script>
    async function requestPairing() {
      const phoneInput = document.getElementById('phone');
      const submitBtn = document.getElementById('submitBtn');
      const codeBox = document.getElementById('codeBox');
      const codeDisplay = document.getElementById('codeDisplay');
      
      const phone = phoneInput.value.replace(/\\D/g, '');
      if (!phone || phone.length < 10) {
        alert('يرجى كتابة رقم الهاتف بالصيغة الدولية مع كود الدولة بشكل صحيح.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = '⏳ جاري تأسيس الاتصال وتوليد الكود...';

      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();

        if (data.success && data.code) {
          codeBox.style.display = 'block';
          codeDisplay.innerText = data.code;
          submitBtn.innerText = '✅ تم استخراج الكود بنجاح!';
        } else {
          alert(data.message || 'حدث خطأ أثناء استخراج الكود.');
          submitBtn.disabled = false;
          submitBtn.innerText = 'الحصول على كود الربط الفوري 🚀';
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = 'الحصول على كود الربط الفوري 🚀';
      }
    }
  </script>
</body>
</html>`;
}

// تشغيل سيرفر الويب المدمج لخدمة صفحة التنصيب و API
export function startWebServer(port = process.env.PORT || 3000) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // الصفحة الرئيسية للموقع
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderHtmlPage());
    }

    // API فحص الحالة
    if (req.method === 'GET' && url.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'online',
        botName: config.botName,
        activeSubBots: activeSubBots.size,
        uptime: process.uptime(),
      }));
    }

    // API طلب كود الربط للبوت الفرعي
    if (req.method === 'POST' && url.pathname === '/api/pair') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const json = JSON.parse(body || '{}');
          const phone = (json.phone || '').replace(/\D/g, '');
          if (!phone || phone.length < 10) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'رقم الهاتف غير صالح.' }));
          }

          console.log(`🌐 [طلب تنصيب ويب] جاري توليد كود للرقم: +${phone}...`);
          const result = await createSubBot(phone);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            code: result.code,
            phone: result.phone,
            message: 'تم توليد كود الربط بنجاح.',
          }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    // مسار غير موجود
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`🌐 [سيرفر الويب] شغال الآن على المنفذ: ${port}`);
    console.log(`🔗 رابط منصة التنصيب: http://localhost:${port}`);
  });

  return server;
}
