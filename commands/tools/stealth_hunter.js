// ══════════════════════════════════════════════════════════════
// 🕵️ مود صائد الرسائل السرية وكاشف المحذوف (Anti-ViewOnce & Anti-Delete)
// ══════════════════════════════════════════════════════════════

import { db, save } from '../../lib/db.js';
import { getStoredMessage } from '../../lib/message_store.js';
import { downloadMediaMessage } from '../../lib/baileys.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

export default [
  {
    name: 'كاشف_المحذوف',
    aliases: ['antidelete', 'كشف_الحذف'],
    desc: 'تشغيل أو إيقاف كاشف الرسائل المحذوفة في الجروب، أو فحص آخر رسالة محذوفة',
    admin: true,
    async run({ isGroup, jid, args, reply }) {
      if (!isGroup) return reply('⛔ هذا الأمر مخصص للمجموعات فقط.');
      const g = db.groups[jid] ??= {};
      const action = (args[0] || '').toLowerCase();

      if (['تشغيل', 'on', 'تفعيل'].includes(action)) {
        g.antidelete = true;
        save();
        return reply('✅ تم *تفعيل* كاشف الرسائل المحذوفة في هذه المجموعة!\nأي رسالة يحذفها عضو سيتم إظهارها فوراً.');
      } else if (['ايقاف', 'إيقاف', 'off', 'تعطيل'].includes(action)) {
        g.antidelete = false;
        save();
        return reply('🛑 تم *إيقاف* كاشف الرسائل المحذوفة في هذه المجموعة.');
      }

      const status = g.antidelete !== false ? 'مفعّل 🟢' : 'معطّل 🔴';
      return reply(`🕵️ *كاشف الرسائل المحذوفة*\n\nالحالة الحالية: *${status}*\n\nللتحكم اكتب:\n▫️ *.كاشف_المحذوف تشغيل*\n▫️ *.كاشف_المحذوف ايقاف*`);
    }
  },

  {
    name: 'صائد_السرية',
    aliases: ['antiviewonce', 'صيد_السرية', 'صائد_الصور'],
    desc: 'التحكم في صائد رسائل العرض لمرة واحدة (View Once)',
    owner: true,
    async run({ args, reply }) {
      db.settings ??= {};
      const action = (args[0] || '').toLowerCase();

      if (['تشغيل', 'on', 'تفعيل'].includes(action)) {
        db.settings.antiViewOnce = true;
        save();
        return reply('👁️ تم *تفعيل* صائد رسائل العرض لمرة واحدة تلقائياً!\nسيتم حفظ وتفكيك أي صورة أو فيديو View Once وإرساله للمطور فوراً.');
      } else if (['ايقاف', 'إيقاف', 'off', 'تعطيل'].includes(action)) {
        db.settings.antiViewOnce = false;
        save();
        return reply('🛑 تم *إيقاف* صائد رسائل العرض لمرة واحدة التلقائي.');
      }

      const status = db.settings.antiViewOnce !== false ? 'مفعّل 🟢' : 'معطّل 🔴';
      return reply(`👁️ *صائد رسائل العرض لمرة واحدة (Anti-ViewOnce)*\n\nالحالة الحالية: *${status}*\n\nللتحكم:\n▫️ *.صائد_السرية تشغيل*\n▫️ *.صائد_السرية ايقاف*\n\n💡 يمكنك أيضاً الرد على أي رسالة سرية بأمر: *.كشف_السر*`);
    }
  },

  {
    name: 'كشف_السر',
    aliases: ['التقاط_السر', 'فك_السر', 'readviewonce', 'rvo'],
    desc: 'الرد على رسالة عرض لمرة واحدة (View Once) لتحميلها وإرسالها كصورة أو فيديو دائم',
    async run({ sock, jid, m, quoted, reply }) {
      if (!quoted || !quoted.message) {
        return reply('⚠️ يرجى الرد على رسالة صورة أو فيديو معمولة (عرض لمرة واحدة / View Once) لتفكيكها.');
      }

      try {
        let inner = quoted.message?.viewOnceMessage?.message ||
          quoted.message?.viewOnceMessageV2?.message ||
          quoted.message?.viewOnceMessageV2Extension?.message ||
          quoted.message;

        const isImage = Boolean(inner?.imageMessage);
        const isVideo = Boolean(inner?.videoMessage);

        if (!isImage && !isVideo) {
          return reply('❌ الرسالة التي قمت بالرد عليها ليست صورة أو فيديو View Once.');
        }

        const buffer = await downloadMediaMessage(
          { key: { remoteJid: jid, id: quoted.id, participant: quoted.participant }, message: inner },
          'buffer',
          {},
          { logger, reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer) return reply('❌ تعذر تحميل الوسائط من الرسالة.');

        const caption = `🕵️ *تم صيد رسالة العرض لمرة واحدة بنجاح!* 🔓\n\n👤 بواسطة: @${quoted.participant ? quoted.participant.split('@')[0] : 'عضو'}`;

        if (isImage) {
          await sock.sendMessage(jid, { image: buffer, caption, mentions: quoted.participant ? [quoted.participant] : [] }, { quoted: m });
        } else {
          await sock.sendMessage(jid, { video: buffer, caption, mentions: quoted.participant ? [quoted.participant] : [] }, { quoted: m });
        }
      } catch (err) {
        reply(`❌ فشل استخراج الوسائط السرية: ${err.message}`);
      }
    }
  }
];
