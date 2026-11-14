import pino from 'pino';
import readline from 'readline';
import { loadCommands, uniqueCommands } from './lib/loader.js';
import { handle } from './handler.js';
import { onParticipants } from './lib/events.js';
import config from './config.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from './lib/baileys.js';

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
          console.log('🔴 تم تسجيل الخروج من واتساب. يرجى مسح مجلد session وإعادة الربط.');
        } else {
          console.log('🔄 انقطع الاتصال، سيتم إعادة المحاولة بعد 4 ثوانٍ...');
          setTimeout(start, 4000);
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        handle(sock, m).catch(e => console.error('Error handling message:', e));
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
