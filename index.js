import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// نظام حماية متقدم ضد أخطاء تشفير الواتساب (Bad MAC / SessionError) لمنع انهيار البوت تلقائياً
const isIgnorableError = (err) => {
  const msg = err?.message || String(err || '');
  const stack = err?.stack || '';
  return (
    msg.includes('Bad MAC') ||
    msg.includes('decryption') ||
    msg.includes('SessionError') ||
    msg.includes('No matching sessions') ||
    msg.includes('Session error') ||
    msg.includes('PreKey') ||
    msg.includes('Closing session') ||
    stack.includes('session_cipher') ||
    stack.includes('libsignal')
  );
};

process.on('uncaughtException', err => {
  if (isIgnorableError(err)) return;
  console.error('UncaughtException:', err?.message || err);
});
process.on('unhandledRejection', err => {
  const stack = err?.stack || '';
  const match = stack.match(/session-([0-9.]+)\.json/) || stack.match(/([0-9]{10,}\.[0-9]+)/);
  if (match && match[1]) {
    try {
      const badFile = path.join('session', `session-${match[1]}.json`);
      if (fs.existsSync(badFile)) {
        fs.unlinkSync(badFile);
        console.log(`🧹 تم إزالة ملف الجلسة التالف تلقائياً لتجديد التشفير: ${badFile}`);
      }
    } catch {}
  }
  if (isIgnorableError(err)) return;
  console.error('UnhandledRejection:', err?.message || err);
});

// اعتراض console.error لمنع سيل رسائل أخطاء التشفير الداخلية من libsignal من إغراق السجلات
const originalConsoleError = console.error;
console.error = function (...args) {
  const fullText = args.map(a => String(a?.stack || a?.message || a || '')).join(' ');
  if (
    fullText.includes('Session error') ||
    fullText.includes('MessageCounterError') ||
    fullText.includes('Key used already') ||
    fullText.includes('Bad MAC') ||
    fullText.includes('Failed to decrypt message') ||
    fullText.includes('No matching sessions') ||
    fullText.includes('Closing session') ||
    fullText.includes('session_cipher') ||
    fullText.includes('خطأ في الجلسة') ||
    fullText.includes('خطأ في عداد الرسائل')
  ) {
    return; // كتم رسائل تشفير الواتساب الداخلية لمنع إغراق السجلات
  }
  originalConsoleError.apply(console, args);
};

// دالة لتنظيف الملفات التالفة فقط في الجلسة إن وجدت دون حذف جلسات التشفير النشطة
function cleanStaleRatchets() {
  try {
    if (fs.existsSync('session')) {
      const files = fs.readdirSync('session');
      for (const f of files) {
        if (f.endsWith('.tmp') || f.endsWith('.corrupt')) {
          try {
            fs.unlinkSync(path.join('session', f));
          } catch {}
        }
      }
    }
  } catch {}
}
import { loadCommands, uniqueCommands } from './lib/loader.js';
import { handle } from './handler.js';
import { onParticipants } from './lib/events.js';
import config from './config.js';
import { db } from './lib/db.js';
import { saveMessage, getStoredMessage } from './lib/message_store.js';
import { initAutoBackup } from './lib/backup.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from './lib/baileys.js';
import { startWebServer, reloadExistingSubBots } from './lib/subbot_server.js';

let webServerStarted = false;
function ensureWebServer() {
  if (!webServerStarted) {
    webServerStarted = true;
    try {
      startWebServer();
      reloadExistingSubBots().catch(() => {});
    } catch (e) {
      console.error('تحذير تشغيل سيرفر الويب:', e.message);
    }
  }
}

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
    ensureWebServer();
    console.log(`\n========================================`);
    console.log(`🚀 [${config.botName.toUpperCase()}] - جاري بدء التشغيل...`);
    console.log(`📦 تم تحميل ${uniqueCommands().length} أمر بنجاح`);
    console.log(`👑 المطور: ${config.developer}`);
    console.log(`========================================\n`);

    // مسح الجلسة إجبارياً إذا تم طلب ذلك عبر متغير البيئة
    if (process.env.CLEAR_SESSION === 'true') {
      clearSessionFiles();
    }

    // فحص ما إذا كانت الجلسة مسجلة أو تالفة أو تابعة لرقم قديم مختلف
    if (fs.existsSync('session/creds.json')) {
      try {
        const raw = JSON.parse(fs.readFileSync('session/creds.json', 'utf8') || '{}');
        if (!raw.registered) {
          clearSessionFiles();
        } else {
          const credPhone = raw.me?.id ? raw.me.id.split(':')[0].split('@')[0].replace(/\D/g, '') : '';
          const targetPhone = config.botNumber ? config.botNumber.replace(/\D/g, '') : '';
          if (credPhone && targetPhone && credPhone !== targetPhone) {
            console.log(`⚠️ تم اكتشاف جلسة قديمة تابعة لرقم (+${credPhone}) بينما رقم البوت المطلوب (+${targetPhone}).`);
            console.log(`🧹 جاري مسح الجلسة القديمة تلقائياً لطلب كود ربط جديد نظيف للرقم الصحيح...`);
            clearSessionFiles();
          }
        }
      } catch {
        clearSessionFiles();
      }
    }

    // تنظيف مفاتيح الشاتات القديمة التي تسبب تعليق التشفير (Bad MAC / Key used already) مع الاحتفاظ بالجلسة المسجلة
    cleanStaleRatchets();

    const { state, saveCreds } = await useMultiFileAuthState('session');

    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch {}

    const msgRetryCounterCache = new Map();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      msgRetryCounterCache,
      getMessage: async key => ({ conversation: '' }),
      shouldIgnoreJid: jid => jid?.endsWith('@broadcast') || jid?.includes('status'),
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
        initAutoBackup(sock);
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

        // كاشف الرسائل المحذوفة (Anti-Delete)
        const protoMsg = m.message?.protocolMessage;
        if (protoMsg && (protoMsg.type === 0 || protoMsg.type === 5)) {
          const deletedId = protoMsg.key?.id;
          const jid = m.key.remoteJid;
          if (deletedId && jid?.endsWith('@g.us')) {
            const g = db.groups[jid] || {};
            if (g.antidelete !== false) {
              const old = getStoredMessage(deletedId);
              if (old && !old.fromMe) {
                const senderNum = (old.participant || m.key.participant || '').split('@')[0];
                let alert = `╭━━━〔 🕵️ *كاشف الرسائل المحذوفة* 〕━━━╮\n│\n` +
                  `│ 👤 العضو: @${senderNum}\n` +
                  `│ 🕒 الوقت: ${new Date(old.timestamp).toLocaleTimeString('ar-EG')}\n` +
                  `│ 🗑️ قام بحذف الرسالة التالية:\n`;
                if (old.text) alert += `│ 💬 "${old.text}"\n`;
                alert += `│\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                if (old.media && old.mime?.startsWith('image/')) {
                  sock.sendMessage(jid, { image: old.media, caption: alert, mentions: [old.participant].filter(Boolean) }).catch(() => {});
                } else if (old.media && old.mime?.startsWith('video/')) {
                  sock.sendMessage(jid, { video: old.media, caption: alert, mentions: [old.participant].filter(Boolean) }).catch(() => {});
                } else {
                  sock.sendMessage(jid, { text: alert, mentions: [old.participant].filter(Boolean) }).catch(() => {});
                }
              }
            }
          }
          continue;
        }

        // تخزين الرسالة للرجوع إليها عند الحذف
        saveMessage(m);

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
