import fs from 'fs';
import path from 'path';
import config from '../../config.js';
import { db, save, saveNow, dbFile } from '../../lib/db.js';
import { numOf, sleep, money, fmtDur } from '../../lib/utils.js';
import { commands, loadCommands } from '../../lib/loader.js';
import { ask } from '../ai/ai.js';

export default [
  {
    name: 'اضف_امر',
    aliases: ['addcmd'],
    desc: 'إضافة أمر مخصص سريع من الشات: /اضف_امر مرحبا أهلاً بك يا غالي',
    owner: true,
    async run({ args, reply, react }) {
      const name = (args[0] || '').toLowerCase().replace(/^[./!#]/, '');
      const response = args.slice(1).join(' ');
      if (!name || !response) return reply('💡 طريقة الاستخدام:\n*/اضف_امر <الاسم> <الرد>*\nمثال: */اضف_امر مسا مساء الفل يا زعيم*');
      db.settings.customCmds ??= {};
      db.settings.customCmds[name] = response;
      save();
      await react('✅');
      reply(`╭━━━〔 ⚡ *تمت إضافة الأمر المخصص* 〕━━━╮\n│\n│ 📌 اسم الأمر: *${name}*\n│ 💬 الرد التلقائي: "${response}"\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    },
  },

  {
    name: 'اعادة_تشغيل',
    aliases: ['restart', 'ريستارت'],
    desc: 'إعادة تشغيل البوت والسيرفر بضغطة زر من واتساب',
    owner: true,
    async run({ reply, react }) {
      await react('🔄');
      await reply('🔄 جاري إعادة تشغيل سيرفر البوت الآن، سيعود للعمل خلال 15 ثانية...');
      saveNow();
      setTimeout(() => process.exit(0), 1000);
    },
  },

  {
    name: 'شوف_رسايل_الناس',
    aliases: ['logs_recent', 'اخر_الرسايل'],
    desc: 'عرض آخر التفاعلات والرسائل الواردة للبوت',
    owner: true,
    async run({ reply, react }) {
      await react('📜');
      const recent = db.settings.recentMsgs || [];
      if (!recent.length) return reply('ℹ️ لا توجد سجلات رسائل حديثة مسجلة بعد.');
      let t = `╭━━━〔 📜 *آخر رسائل المستخدمين* 〕━━━╮\n│\n`;
      recent.slice(-10).reverse().forEach((r, i) => {
        t += `│ [${i + 1}] @${r.sender}: "${r.text}"\n│     ↳ ⏱️ ${new Date(r.time).toLocaleTimeString('ar-EG')}\n`;
      });
      t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      reply(t, recent.map(r => r.sender + '@s.whatsapp.net'));
    },
  },

  {
    name: 'وضع_الشبح',
    aliases: ['ghost_mode', 'شبح'],
    desc: 'تفعيل/إلغاء وضع الشبح (البوت خفي تماماً)',
    owner: true,
    async run({ reply, react }) {
      db.settings.ghost = !db.settings.ghost;
      save();
      await react('👻');
      reply(`╭━━━〔 👻 *وضع الشبح* 〕━━━╮\n│\n│ الحالة الآن: *${db.settings.ghost ? 'مُفعّل (خفي)' : 'مُعطّل (عادي)'}*\n│ 📌 في وضع الشبح، يعمل البوت بصمت تام دون إظهار أي مؤشرات.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    },
  },

  {
    name: 'غير_شخصية_البوت',
    aliases: ['set_personality', 'شخصية_البوت'],
    desc: 'تغيير أسلوب ردود البوت: ساخر، جاد، رومانسي، حكيم',
    owner: true,
    async run({ args, reply, react }) {
      const mode = (args[0] || '').toLowerCase();
      const valid = ['ساخر', 'جاد', 'رومانسي', 'حكيم', 'طبيعي'];
      if (!valid.includes(mode)) {
        return reply(`💡 اختر شخصية البوت:\n*/غير_شخصية_البوت ساخر*\nالمتاح: (${valid.join(' - ')})`);
      }
      db.settings.personality = mode;
      save();
      await react('🎭');
      reply(`✅ تم تعيين شخصية البوت بنجاح إلى: *[ ${mode} ]*!`);
    },
  },

  {
    name: 'وضع_التعلم',
    aliases: ['learning_mode'],
    desc: 'تفعيل/تعطيل ميزة تعلم البوت من إجابات المطور',
    owner: true,
    async run({ reply, react }) {
      db.settings.learning = !db.settings.learning;
      save();
      await react('🧠');
      reply(`🧠 وضع التعلم الذاتي الآن: *${db.settings.learning ? 'مُفعّل 🟢' : 'مُعطّل 🔴'}*`);
    },
  },

  {
    name: 'انسخ_البوت',
    aliases: ['backup_all', 'باك_اب'],
    desc: 'أخذ نسخة احتياطية كاملة من قاعدة البيانات والإعدادات وإرسالها',
    owner: true,
    async run({ send, reply, react }) {
      await react('📦');
      saveNow();
      if (fs.existsSync(dbFile)) {
        const buf = fs.readFileSync(dbFile);
        await send({
          document: buf,
          mimetype: 'application/json',
          fileName: `no_and_no_backup_${Date.now()}.json`,
          caption: `📦 *نسخة احتياطية كاملة للبوت (Backup)*\n📅 التاريخ: ${new Date().toLocaleString('ar-EG')}`,
        });
      } else {
        reply('❌ تعذر العثور على ملف قاعدة البيانات.');
      }
    },
  },

  {
    name: 'زر_الطوارئ',
    aliases: ['emergency', 'طوارئ'],
    desc: 'إيقاف فوري لكافة الأوامر وإعلان وضع الاستراحة',
    owner: true,
    async run({ reply, react }) {
      db.settings.emergency = !db.settings.emergency;
      save();
      await react('🚨');
      if (db.settings.emergency) {
        reply('🚨 *تم تفعيل زر الطوارئ!* البوت الآن في وضع النوم ولن يستجيب لأي عضو حتى يتم إلغاء الطوارئ.');
      } else {
        reply('🟢 *تم إلغاء زر الطوارئ!* البوت يعمل الآن بكامل طاقته لجميع الأعضاء.');
      }
    },
  },

  {
    name: 'مين_بيجرب_يخترقني',
    aliases: ['breach_logs', 'سجل_المتطفلين'],
    desc: 'عرض قائمة الأعضاء الذين حاولوا استخدام أوامر المطورين بدون إذن',
    owner: true,
    async run({ reply, react }) {
      await react('🛡️');
      const attempts = db.settings.hackAttempts || [];
      if (!attempts.length) return reply('✅ لا توجد أي محاولات مشبوهة أو اختراق مسجلة!');
      let t = `╭━━━〔 🚨 *سجل محاولات استخدام أوامر المطور* 〕━━━╮\n│\n`;
      attempts.slice(-10).reverse().forEach((a, i) => {
        t += `│ [${i + 1}] 👤 @${a.user}\n│     ↳ ⌨️ حاول كتابة: *${a.cmd}*\n│     ↳ ⏱️ ${new Date(a.time).toLocaleString('ar-EG')}\n`;
      });
      t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      reply(t, attempts.map(a => a.user + '@s.whatsapp.net'));
    },
  },

  {
    name: 'حولني_لمطور',
    aliases: ['add_dev', 'مطور_جديد'],
    desc: 'إضافة مطور مساعد بصلاحيات: /حولني_لمطور @شخص',
    owner: true,
    async run({ target, args, reply, react }) {
      if (!target) return reply('↩️ منشن الشخص الذي تريد ترقيته لمطور مساعد.');
      const k = numOf(target);
      db.settings.subDevs ??= [];
      if (db.settings.subDevs.includes(k)) return reply('ℹ️ هذا العضو مطور بالفعل.');
      db.settings.subDevs.push(k);
      save();
      await react('👑');
      reply(`👑 تم تعيين @${k} مطوراً مساعداً في البوت بنجاح!`, [target]);
    },
  },

  {
    name: 'اسحب_الصلاحية',
    aliases: ['remove_dev'],
    desc: 'سحب رتبة المطور المساعد: /اسحب_الصلاحية @شخص',
    owner: true,
    async run({ target, reply, react }) {
      if (!target) return reply('↩️ منشن الشخص المراد سحب الصلاحية منه.');
      const k = numOf(target);
      db.settings.subDevs = (db.settings.subDevs || []).filter(x => x !== k);
      save();
      await react('🔻');
      reply(`🔻 تم سحب صلاحيات المطور من @${k} بنجاح.`, [target]);
    },
  },

  {
    name: 'وضع_الترند',
    aliases: ['bot_trend', 'الترند'],
    desc: 'إحصائيات أكثر الأوامر طلباً اليوم والجروبات الأكثر نشاطاً',
    owner: true,
    async run({ reply, react }) {
      await react('📊');
      const counts = db.settings.cmdCounts || {};
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      let t = `╭━━━〔 📈 *تريند أكثر الأوامر استخداماً* 〕━━━╮\n│\n`;
      if (!sorted.length) {
        t += `│ لا توجد إحصائيات كافية مسجلة اليوم.\n`;
      } else {
        sorted.forEach(([cmdName, count], i) => {
          t += `│ [0${i + 1}] ▫️ *${cmdName}* ─── (${count} مرة)\n`;
        });
      }
      t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      reply(t);
    },
  },

  {
    name: 'خلي_البوت_يتصل',
    aliases: ['bot_call', 'اتصال_صوتي'],
    desc: 'إرسال فويس نوت بصوت المطور للجروب أو الشخص',
    owner: true,
    async run({ text, sock, jid, m, reply, react }) {
      if (!text) return reply('💡 اكتب الكلام الذي تريد أن يقوله البوت صوتياً.\nمثال: */خلي_البوت_يتصل السلام عليكم يا شباب منورين الجروب*');
      await react('🎙️');
      try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=ar&client=tw-ob`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('فشل جلب الصوت');
        const buffer = Buffer.from(await r.arrayBuffer());
        await sock.sendMessage(jid, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true,
        }, { quoted: m });
      } catch (e) {
        reply(`❌ فشل الاتصال الصوتي: ${e.message}`);
      }
    },
  },

  {
    name: 'توقع_المشكلة',
    aliases: ['health_check', 'فحص_النظام'],
    desc: 'فحص صحة النظام، الذاكرة، والأخطاء وتوقع المشاكل مسبقاً',
    owner: true,
    async run({ reply, react }) {
      await react('🩺');
      const mem = process.memoryUsage();
      const ramMB = (mem.rss / 1024 / 1024).toFixed(1);
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const errorsCount = (db.settings.errors || []).length;
      let status = 'ممتازة 🟢';
      let warnings = [];

      if (ramMB > 350) warnings.push('⚠️ استهلاك الرام مرتفع نسبياً.');
      if (errorsCount > 10) warnings.push('⚠️ هناك عدة أخطاء مسجلة في سجل النظام.');
      if (!warnings.length) warnings.push('✨ كل الأنظمة تعمل بكفاءة وثبات 100%.');

      let t = `╭━━━〔 🩺 *تقرير الفحص الصحي للبوت* 〕━━━╮\n│\n`;
      t += `│ 💾 استهلاك الرام: *${ramMB} MB*\n`;
      t += `│ 🗄️ ذاكرة الهيب: *${heapMB} MB*\n`;
      t += `│ 📦 عدد الأوامر الشغالة: *${commands.size}*\n`;
      t += `│ 🚨 الأخطاء المسجلة: *${errorsCount}*\n`;
      t += `│ 🩺 الحالة العامة: *${status}*\n│\n`;
      t += `│ 📌 التوقعات والتوصيات:\n`;
      warnings.forEach(w => t += `│  ${w}\n`);
      t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      reply(t);
    },
  },

  {
    name: 'وضع_الواقع_المعزز',
    aliases: ['ar_mode', 'فلتر_سينمائي'],
    desc: 'تعديل الصور وتحويلها لستايل سينمائي أو كرتوني بالذكاء الاصطناعي',
    owner: true,
    async run({ text, quotedText, reply, react, sock, jid, m }) {
      const q = text || quotedText || 'anime cyberpunk cinematic portrait';
      await react('✨');
      await reply('⏳ جاري إنشاء العمل الفني السينمائي بالواقع المعزز...');
      try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(q + ', masterpiece, photorealistic, 8k, unreal engine 5')}?width=800&height=800&nologo=true`;
        await sock.sendMessage(jid, {
          image: { url },
          caption: `╭━━━〔 🎬 *وضع الواقع المعزز السينمائي* 〕━━━╮\n│\n│ 🎨 النمط: Cinematic Render\n│ 📝 الفكرة: ${q}\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        }, { quoted: m });
      } catch (e) {
        reply(`❌ فشل المعالجة: ${e.message}`);
      }
    },
  },

  {
    name: 'حدث_نفسك',
    aliases: ['reload_commands', 'تحديث_فوري'],
    desc: 'إعادة تحميل كافة ملفات الأوامر فورياً بدون ريستارت',
    owner: true,
    async run({ reply, react }) {
      await react('⚡');
      await loadCommands();
      reply(`╭━━━〔 ⚡ *تم التحديث الفوري* 〕━━━╮\n│\n│ ✅ تم فحص وتحميل كافة الأوامر بنجاح!\n│ 📦 إجمالي الأوامر الآن: *${commands.size}* أمر جاهز للعمل.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    },
  },

  {
    name: 'نقل_الملكية',
    aliases: ['transfer_owner'],
    desc: 'نقل ملكية البوت الأساسية لرقم جديد: /نقل_الملكية 2010...',
    owner: true,
    async run({ args, reply, react }) {
      const newNum = (args[0] || '').replace(/\D/g, '');
      if (newNum.length < 8) return reply('💡 اكتب رقم المطور الجديد كاملاً بالصيغة الدولية.\nمثال: */نقل_الملكية 201123456789*');
      db.settings.primaryOwner = newNum;
      save();
      await react('👑');
      reply(`👑 تم نقل ملكية البوت بالكامل للرقم: *+${newNum}*!`);
    },
  },

  {
    name: 'اعادة_ضبط_المصنع',
    aliases: ['factory_reset'],
    desc: 'تصفير كافة الإعدادات والبيانات بالكامل (حذر!)',
    owner: true,
    async run({ args, reply, react }) {
      if (args[0] !== 'تاكيد') {
        return reply('⚠️ *تحذير خطير جداً!*\nهذا الأمر سيمسح كل بيانات البوت ويرجعه كأول يوم.\nللتأكيد اكتب: */اعادة_ضبط_المصنع تاكيد*');
      }
      db.users = {};
      db.groups = {};
      db.settings = { banned: [], disabled: [] };
      saveNow();
      await react('💥');
      reply('💥 تم إعادة ضبط المصنع للبوت بنجاح! تم تصفير كافة السجلات.');
    },
  },

  {
    name: 'اقفل_البوت_للابد',
    aliases: ['lock_bot'],
    desc: 'قفل البوت بالكامل برمز سري لا يفتحه غيرك',
    owner: true,
    async run({ args, reply, react }) {
      const pin = args[0];
      if (!pin) return reply('💡 اكتب الرمز السري للقفل.\nمثال: */اقفل_البوت_للابد 1234*');
      db.settings.lockPin = pin;
      db.settings.locked = true;
      save();
      await react('🔒');
      reply(`🔒 تم قفل البوت برمز سري بنجاح! لن يستجيب البوت لأي أمر حتى كتابة: */افتح_البوت ${pin}*`);
    },
  },

  {
    name: 'افتح_البوت',
    aliases: ['unlock_bot'],
    desc: 'فتح قفل البوت بالرمز السري',
    owner: true,
    async run({ args, reply, react }) {
      const pin = args[0];
      if (pin !== db.settings.lockPin) return reply('❌ رمز PIN غير صحيح!');
      db.settings.locked = false;
      delete db.settings.lockPin;
      save();
      await react('🔓');
      reply('🔓 تم فك قفل البوت بنجاح! البوت يعمل الآن بشكل طبيعي.');
    },
  },

  {
    name: 'وضع_المالك_الوحيد',
    aliases: ['sole_owner'],
    desc: 'إلغاء كافة المطورين المساعدين وحصر التحكم بك وحدك',
    owner: true,
    async run({ reply, react }) {
      db.settings.subDevs = [];
      save();
      await react('👑');
      reply('👑 تم تفعيل وضع المالك الوحيد! تم عزل كافة المطورين المساعدين وحصر الصلاحيات بالكامل فيك وحدك.');
    },
  },

  {
    name: 'غير_اسم_البوت_في_كل_مكان',
    aliases: ['set_all_botname'],
    desc: 'تغيير اسم البوت الرسمي في كافة القوائم: /غير_اسم_البوت_في_كل_مكان الاسم',
    owner: true,
    async run({ text, reply, react }) {
      if (!text) return reply('💡 اكتب الاسم الجديد للبوت.');
      config.botName = text.trim();
      config.developer = text.trim();
      db.settings.customBotName = text.trim();
      save();
      await react('🏷️');
      reply(`✅ تم تحديث اسم البوت في كل مكان بنجاح إلى: *${text.trim()}*!`);
    },
  },

  {
    name: 'سجل_كل_حاجة',
    aliases: ['full_logger'],
    desc: 'تفعيل/إلغاء تسجيل كل رسالة وأمر في ملف تقرير يومي',
    owner: true,
    async run({ reply, react }) {
      db.settings.fullLogging = !db.settings.fullLogging;
      save();
      await react('📝');
      reply(`📝 وضع تسجيل كل حركة الآن: *${db.settings.fullLogging ? 'مُفعّل 🟢' : 'مُعطّل 🔴'}*`);
    },
  },

  {
    name: 'استدعاء_طارئ',
    aliases: ['emergency_call'],
    desc: 'إرسال بيانات البوت والنسخة الاحتياطية لرقمك الاحتياطي',
    owner: true,
    async run({ text, sock, reply, react }) {
      const targetPhone = (text || '').replace(/\D/g, '');
      if (targetPhone.length < 8) return reply('💡 اكتب الرقم الاحتياطي لاستلام البيانات.\nمثال: */استدعاء_طارئ 201123456789*');
      await react('📡');
      try {
        saveNow();
        const jid = targetPhone + '@s.whatsapp.net';
        await sock.sendMessage(jid, {
          text: `🚨 *استدعاء طارئ من مطور البوت!*\n📦 تم طلب إرسال النسخة الاحتياطية لبيانات السيرفر الآن.`,
        });
        if (fs.existsSync(dbFile)) {
          const buf = fs.readFileSync(dbFile);
          await sock.sendMessage(jid, {
            document: buf,
            mimetype: 'application/json',
            fileName: 'emergency_backup.json',
          });
        }
        reply(`✅ تم إرسال بيانات الاستدعاء الطارئ إلى الرقم: *+${targetPhone}* بنجاح!`);
      } catch (e) {
        reply(`❌ فشل الإرسال للرقم الاحتياطي: ${e.message}`);
      }
    },
  },
];
