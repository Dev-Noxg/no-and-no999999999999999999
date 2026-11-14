import config from '../config.js';
import sections from './sections.js';
import { uniqueCommands } from './loader.js';
import { fmtDur } from './utils.js';

const startedAt = Date.now();

export function mainMenu(pushName = 'صديقي') {
  const all = uniqueCommands();
  const date = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let t = `╭━━━〔 ⚡ *${config.botName.toUpperCase()}* ⚡ 〕━━━╮\n`;
  t += `│\n`;
  t += `│ 👤 مرحباً: *${pushName}*\n`;
  t += `│ 👑 المطور: *${config.developer}*\n`;
  t += `│ ⚡ البادئة: [ *${config.prefix}* ]\n`;
  t += `│ 📦 إجمالي الأوامر: *${all.length}* أمر\n`;
  t += `│ ⏱️ مدة التشغيل: *${fmtDur(Date.now() - startedAt)}*\n`;
  t += `│ 📅 اليوم: *${date}*\n`;
  t += `│ 🟢 الحالة: *متصل ونشط*\n`;
  t += `│\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  t += `╭━━━〔 📂 *قائمة الأقسام* 〕━━━╮\n│\n`;
  sections.forEach((s, i) => {
    const count = all.filter(c => c.section === s.key).length;
    const num = `[${String(i + 1).padStart(2, '0')}]`;
    t += `│ ${num} ${s.emoji} *${s.name}* ${lineFiller(s.name, count)} (${count})\n`;
  });
  t += `│\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  t += `💡 *طريقة الاستخدام:*\n`;
  t += `▫️ اكتب: *${config.prefix}اوامر <رقم القسم>*\n`;
  t += `   مثال: *${config.prefix}اوامر 2*\n`;
  t += `▫️ للبحث السريع: *${config.prefix}بحث <الاسم>*\n\n`;
  t += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `⚡ *بواسطة:* ${config.developer} ✦`;

  return t;
}

function lineFiller(label, count) {
  const used = label.length + String(count).length;
  const target = 16;
  const dotsCount = Math.max(2, target - used);
  return '─'.repeat(dotsCount);
}

export function sectionMenu(num) {
  const s = sections[num - 1];
  if (!s) {
    return `❌ *رقم القسم غير صحيح!*\nاكتب *${config.prefix}اوامر* لعرض قائمة الأقسام بالأرقام.`;
  }

  const list = uniqueCommands().filter(c => c.section === s.key);

  let t = `╭━━━〔 ${s.emoji} *قسم ${s.name}* 〕━━━╮\n`;
  t += `│ 📖 ${s.desc}\n`;
  t += `│ 📦 عدد الأوامر: *${list.length}* أمر\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  if (!list.length) {
    t += '🔸 لا توجد أوامر متوفرة في هذا القسم حالياً.';
    return t;
  }

  t += `╭━━━「 *قائمة الأوامر* 」━━━\n│\n`;
  t += list
    .map(c => {
      const tag = c.owner ? '👑' : c.admin ? '🛡️' : c.group ? '👥' : '🔹';
      const aliases = c.aliases && c.aliases.length ? ` [${c.aliases.slice(0, 2).join(', ')}]` : '';
      return `│ ${tag} *${config.prefix}${c.name}*${aliases}\n│    ↳ ${c.desc || '—'}`;
    })
    .join('\n│\n');

  t += `\n│\n╰━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `📌 *دليل الرموز:*\n`;
  t += `👑 للمطور  |  🛡️ للأدمنية فقط  |  👥 للمجموعات فقط\n`;
  t += `⚡ *${config.botName}*`;

  return t;
}
