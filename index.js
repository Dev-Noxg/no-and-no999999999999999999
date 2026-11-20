import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { loadCommands, uniqueCommands } from './lib/loader.js';
import { handle } from './handler.js';
import { onParticipants } from './lib/events.js';
import config from './config.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from './lib/baileys.js';

// دالة آمنة لمسح محتويات الجلسة دون حذف مجلد الـ Volume لتجنب خطأ EBUSY
function clearSessionFiles() {
  try {
    if (fs.existsSync('session')) {
      const files = fs.readdirSync('session');
      for (const file of files) {
        try {
          fs.rmSync(path.join('session', file), { recursive: true, force: true });
        } catch {}
      }
      console.log('🧹 تم مسح ملفات الجلسة القديمة بنجاح');
    }
  } catch (e) {
    console.error('تحذير مسح الجلسة:', e.message);
  }
}

// ✅ استعادة الجلسة من متغير البيئة (للنشر على Railway/Heroku)
if (process.env.SESSION_CREDS) {
  try {
    fs.mkdirSync('session', { recursive: true });
    const creds = Buffer.from(process.env.SESSION_CREDS, 'base64').toString('utf8');
    fs.writeFileSync(path.join('session', 'creds.json'), creds);
    console.log('✅ تم استعادة الجلسة من متغير البيئة');
  } catch (e) {
    console.error('❌ فشل استعادة الجلسة:', e.message);
  }
}

// ✅ تفعيل كوكيز يوتيوب من متغير البيئة
if (process.env.YOUTUBE_COOKIES && !fs.existsSync('cookies.txt')) {
  try {
    fs.writeFileSync('cookies.txt', process.env.YOUTUBE_COOKIES.trim(), 'utf8');
    console.log('✅ تم تفعيل ملف cookies.txt من متغيرات البيئة بنجاح');
  } catch (e) {
    console.error('❌ فشل حفظ كوكيز يوتيوب:', e.message);
  }
}

const ask = q => new Promise(r => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => {
    rl.close();
    r(a.trim());
  });
});

let isConnecting = false;

async function start() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    await loadCommands();
    console.log(`\n========================================`);
    console.log(`🚀 [${config.botName.toUpperCase()}] - جاري بدء التشغيل...`);
    console.log(`📦 تم تحميل ${uniqueCommands().length} أمر بنجاح`);
    console.log(`👑 المطور: ${config.developer}`);
    console.log(`========================================\n`);

    // فحص ما إذا كانت الجلسة مسجلة أو تالفة ومسح محتوياتها بأمان
    if (fs.existsSync('session/creds.json')) {
      try {
        const raw = JSON.parse(fs.readFileSync('session/creds.json', 'utf8') || '{}');
        if (!raw.registered) {
          clearSessionFiles();
        }
      } catch {
        clearSessionFiles();
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');

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
    });

    sock.ev.on('creds.update', saveCreds);

    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // طلب كود الربط إذا لم يكن مسجلاً بعد
      if (qr && !sock.authState.creds.registered && !pairingRequested) {
        pairingRequested = true;
        try {
          const rawNum = config.botNumber || await ask('اكتب رقم البوت بالصيغة الدولية بدون +: ');
          const number = rawNum.replace(/\D/g, '');
          const code = await sock.requestPairingCode(number);
          console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
          console.log(`  🔑 كود الربط: [ ${code} ]`);
          console.log(`  📱 واتساب > الأجهزة المرتبطة > ربط برقم الهاتف`);
          console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`);
        } catch (e) {
          console.error('❌ فشل طلب كود الربط:', e.message);
          pairingRequested = false;
        }
      }

      if (connection === 'open') {
        isConnecting = false;
        console.log(`\n========================================`);
        console.log(`🟢 [${config.botName}] متصل وشغال بنجاح الآن!`);
        console.log(`========================================\n`);
      }

      if (connection === 'close') {
        isConnecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('🔴 انتهت صلاحية الكود أو الجلسة. جاري تنظيف الملفات وطلب كود جديد...');
          clearSessionFiles();
          setTimeout(start, 3000);
        } else {
          console.log('🔄 انقطع الاتصال، سيتم إعادة المحاولة بعد 4 ثوانٍ...');
          setTimeout(start, 4000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const m of messages) {
        if (!m?.message) continue;
        console.log(`📩 [رسالة جديدة] من: ${m.key.remoteJid} | fromMe: ${m.key.fromMe}`);
        handle(sock, m).catch(e => console.error('❌ خطأ في معالجة الرسالة:', e));
      }
    });

    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      onParticipants(sock, id, participants, action).catch(e => console.error('Error in participant update:', e));
    });

  } catch (err) {
    isConnecting = false;
    console.error('❌ خطأ أثناء بدء البوت:', err);
    setTimeout(start, 5000);
  }
}

start();
