import config from '../config.js';
import sections from './sections.js';
import { uniqueCommands } from './loader.js';
import { fmtDur, money, getRank } from './utils.js';

const startedAt = Date.now();

export function mainMenu(pushName = 'صديقي', userObj = null, speedMs = 35) {
  const all = uniqueCommands();
  const date = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const u = userObj || { money: 100, bank: 0, level: 1, xp: 0 };
  const rank = getRank(u.level || 1);

  let t = `╭━━━〔 ⚡ *${config.botName.toUpperCase()} BOT* ⚡ 〕━━━╮\n`;
  t += `│ ✦ ─── • 💎 *نظام التحكم الفاخر* 💎 • ─── ✦\n│\n`;
  t += `│ 👑 *المطور:* ${config.developer}\n`;
  t += `│ ⚡ *البادئة:* [ *${config.prefix}* أو *.* ]\n`;
  t += `│ 📦 *الأوامر:* *${all.length}* أمر متاح\n`;
  t += `│ 🚀 *سرعة البوت:* *${speedMs}ms* ⚡\n`;
  t += `│ 💾 *استهلاك الرام:* *${ram} MB*\n`;
  t += `│ ⏱️ *مدة التشغيل:* *${fmtDur(Date.now() - startedAt)}*\n`;
  t += `│ 📅 *التاريخ:* *${date}*\n│\n`;
  t += `│ ✦ ─── • 👤 *بيانات العضو* • ─── ✦\n`;
  t += `│ 🏷️ *الاسم:* *${pushName}*\n`;
  t += `│ 💵 *الكاش:* *${money(u.money || 0)}* 💵\n`;
  t += `│ 🏦 *البنك:* *${money(u.bank || 0)}* 🪙\n`;
  t += `│ 🌟 *المستوى:* *Lv.${u.level || 1}* (${u.xp || 0} XP)\n`;
  t += `│ 🎖️ *الرتبة:* ${rank}\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  t += `╭━━━〔 📂 *دليل الأقسام الشامل* 〕━━━╮\n│\n`;
  sections.forEach((s, i) => {
    const count = all.filter(c => c.section === s.key).length;
    const num = `[${String(i + 1).padStart(2, '0')}]`;
    t += `│ ${num} ${s.emoji} *${s.name}* ─── (${count} أمر)\n`;
  });
  t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  t += `💡 *طرق التصفح السريع:*\n`;
  t += `▫️ اكتب رقم القسم مباشرة، مثلاً: *${config.prefix}8* أو *${config.prefix}اوامر 8*\n`;
  t += `▫️ للبحث السريع عن أي أمر: *${config.prefix}بحث <اسم الأمر>*\n`;
  t += `▫️ للتحدث مع الذكاء الاصطناعي مجاناً: *${config.prefix}اسأل <سؤالك>*\n`;
  t += `▫️ لتوليد صور بالذكاء الاصطناعي: *${config.prefix}تخيل <وصف الصورة>*\n`;
  t += `▫️ لتحميل أي أغنية بسرعة البرق: *${config.prefix}اغنية <اسم الأغنية>*\n\n`;
  t += `✦ ──────────────────── ✦\n`;
  t += `⚡ *${config.botName}* ✦ سيرفر دائم ومستقر 24/7`;

  return t;
}

export function sectionMenu(num) {
  const s = sections[num - 1];
  if (!s) {
    return `❌ *رقم القسم غير صحيح!*\nاكتب *${config.prefix}اوامر* لعرض قائمة الأقسام من [01] إلى [${sections.length}].`;
  }

  const list = uniqueCommands().filter(c => c.section === s.key);

  let t = `╭━━━〔 ${s.emoji} *قسم ${s.name}* 〕━━━╮\n`;
  t += `│ 📖 ${s.desc}\n`;
  t += `│ 📦 إجمالي الأوامر: *${list.length}* أمر\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  if (!list.length) {
    t += '🔸 لا توجد أوامر متوفرة في هذا القسم حالياً.';
    return t;
  }

  t += `╭━━━「 📜 *الأوامر المتاحة* 」━━━\n│\n`;
  t += list
    .map(c => {
      const tag = c.owner ? '👑' : c.admin ? '🛡️' : c.group ? '👥' : '🔹';
      const aliases = c.aliases && c.aliases.length ? ` [${c.aliases.slice(0, 2).join(', ')}]` : '';
      return `│ ${tag} *${config.prefix}${c.name}*${aliases}\n│    ↳ 💬 ${c.desc || '—'}`;
    })
    .join('\n│\n');

  t += `\n│\n╰━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `📌 *دليل الرموز:*\n`;
  t += `👑 للمطور  |  🛡️ للأدمن فقط  |  👥 للمجموعات فقط\n`;
  t += `⚡ *${config.botName}*`;

  return t;
}
