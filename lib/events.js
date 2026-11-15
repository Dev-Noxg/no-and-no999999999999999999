import { group } from './db.js';
import { numOf } from './utils.js';
import { clearMeta } from '../handler.js';

const fill = (tpl, { user, subject, count }) =>
  tpl
    .replaceAll('{user}', '@' + numOf(user))
    .replaceAll('{group}', subject)
    .replaceAll('{count}', count);

export async function onParticipants(sock, id, participants, action) {
  clearMeta(id);
  const g = group(id);
  let meta;
  try {
    meta = await sock.groupMetadata(id);
  } catch {
    return;
  }
  const list = participants.map(p => (typeof p === 'string' ? p : p.phoneNumber || p.id));

  for (const p of list) {
    if (action === 'add') {
      const k = numOf(p);
      // فحص الحظر
      if (g.banned && g.banned.includes(k)) {
        await sock.groupParticipantsUpdate(id, [p], 'remove').catch(() => {});
        await sock.sendMessage(id, {
          text: `╭━━━〔 🚫 *طرد محظور* 〕━━━╮\n│\n│ ⛔ العضو @${k} محظور مسبقاً من المجموعة وتم طرده تلقائياً.\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`,
          mentions: [p],
        });
        continue;
      }

      // فحص حظر الأرقام الوهمية والأجنبية
      if (g.antifake) {
        const isArab = /^(20|966|971|965|974|973|968|962|961|963|964|212|213|216|218|249|967|970|972)/.test(k);
        if (!isArab) {
          await sock.groupParticipantsUpdate(id, [p], 'remove').catch(() => {});
          await sock.sendMessage(id, {
            text: `╭━━━〔 🛡️ *حماية الأرقام الوهمية* 〕━━━╮\n│\n│ 🚫 تم طرد الرقم الأجنبي @${k} تلقائياً!\n│ 🔒 خاصية حظر الأرقام الوهمية مفعلة في المجموعة.\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`,
            mentions: [p],
          });
          continue;
        }
      }

      // رسالة الترحيب بصورة العضو إن وُجدت
      if (g.welcome) {
        const defaultWelcome = `╭━━━〔 🌹 *أهلاً بك في المجموعة* 〕━━━╮\n│ ✦ • ──────────────────── • ✦\n│ 👋 مرحباً بك يا {user} في مجموعة:\n│ 👥 *{group}*\n│ 🔢 أنت العضو رقم: *{count}*\n│ 📜 يرجى الالتزام بالقوانين واحترام الجميع.\n│ ✦ • ──────────────────── • ✦\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
        const tpl = g.welcomeMsg || defaultWelcome;
        const msgText = fill(tpl, { user: p, subject: meta.subject, count: meta.participants.length });
        let pfp = null;
        try {
          pfp = await sock.profilePictureUrl(p, 'image');
        } catch {}

        if (pfp) {
          await sock.sendMessage(id, { image: { url: pfp }, caption: msgText, mentions: [p] }).catch(async () => {
            await sock.sendMessage(id, { text: msgText, mentions: [p] });
          });
        } else {
          await sock.sendMessage(id, { text: msgText, mentions: [p] });
        }
      }
    }

    if (action === 'remove' && g.bye) {
      const defaultBye = `╭━━━〔 👋 *توديع عضو* 〕━━━╮\n│ ✦ • ──────────────────── • ✦\n│ 🚶‍♂️ غادر {user} مجموعة *{group}*.\n│ 💐 نتمنى له كل التوفيق.\n│ 👥 عدد الأعضاء الحالي: *{count}*\n│ ✦ • ──────────────────── • ✦\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
      const tpl = g.byeMsg || defaultBye;
      const msgText = fill(tpl, { user: p, subject: meta.subject, count: meta.participants.length });
      let pfp = null;
      try {
        pfp = await sock.profilePictureUrl(p, 'image');
      } catch {}

      if (pfp) {
        await sock.sendMessage(id, { image: { url: pfp }, caption: msgText, mentions: [p] }).catch(async () => {
          await sock.sendMessage(id, { text: msgText, mentions: [p] });
        });
      } else {
        await sock.sendMessage(id, { text: msgText, mentions: [p] });
      }
    }

    if (action === 'promote') {
      await sock.sendMessage(id, {
        text: `╭━━━〔 🛡️ *ترقية إدارية جديدة* 〕━━━╮\n│ ✦ • ──────────────────── • ✦\n│ 🎖️ مبروك الترقية يا @${numOf(p)}!\n│ 👑 أصبحت الآن مشرفاً (Admin) في المجموعة.\n│ ✦ • ──────────────────── • ✦\n╰━━━━━━━━━━━━━━━━━━━━━╯`,
        mentions: [p],
      }).catch(() => {});
    }

    if (action === 'demote') {
      await sock.sendMessage(id, {
        text: `╭━━━〔 🔻 *تنزيل رتبة إدارية* 〕━━━╮\n│ ✦ • ──────────────────── • ✦\n│ 📉 تم تنزيل العضو @${numOf(p)} من رتبة الإشراف.\n│ ✦ • ──────────────────── • ✦\n╰━━━━━━━━━━━━━━━━━━━━━╯`,
        mentions: [p],
      }).catch(() => {});
    }
  }
}
