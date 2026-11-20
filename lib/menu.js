import config from '../config.js';
import sections from './sections.js';
import { uniqueCommands } from './loader.js';
import { fmtDur, money, getRank } from './utils.js';
import { getActiveTheme } from './theme_engine.js';

const startedAt = Date.now();

export function mainMenu(pushName = 'صديقي', userObj = null, speedMs = 35) {
  const all = uniqueCommands();
  const theme = getActiveTheme();
  const date = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const u = userObj || { money: 100, bank: 0, level: 1, xp: 0 };
  const rank = getRank(u.level || 1);

  let t = `╭───〔 ${theme.title} 〕───╮\n`;
  t += `│ ${theme.decor} ──── • ${theme.subtitle} • ──── ${theme.decor}\n│\n`;
  t += `│ 👑 *المطور الأساسي:* ${config.developer}\n`;
  t += `│ ⚡ *بادئة التحكم:* [ *${config.prefix}* أو *.* ]\n`;
  t += `│ 🎭 *المود النشط:* *${theme.name}*\n`;
  t += `│ 📦 *ترسانة الأوامر:* *${all.length}* أمر نشط\n`;
  t += `│ 🚀 *سرعة الاستجابة:* *${speedMs}ms* ⚡\n`;
  t += `│ 💾 *استهلاك الذاكرة:* *${ram} MB*\n`;
  t += `│ ⏱️ *وقت التشغيل المتواصل:* *${fmtDur(Date.now() - startedAt)}*\n`;
  t += `│ 📅 *التاريخ:* *${date}*\n│\n`;
  t += `│ ${theme.decor} ──── • 👤 *بيانات العضو* • ──── ${theme.decor}\n`;
  t += `│ 🏷️ *الاسم:* *${pushName}*\n`;
  t += `│ 💵 *الكاش:* *${money(u.money || 0)}* 💵\n`;
  t += `│ 🏦 *البنك:* *${money(u.bank || 0)}* 🪙\n`;
  t += `│ 🌟 *المستوى:* *Lv.${u.level || 1}* (${u.xp || 0} XP)\n`;
  t += `│ 🎖️ *الرتبة:* ${rank}\n`;
  t += `╰────────────────────────────╯\n\n`;

  t += `╭───〔 📁 *أقسام البوت الشاملة* 〕───╮\n│\n`;
  sections.forEach((s, i) => {
    const count = all.filter(c => c.section === s.key).length;
    const num = `[${String(i + 1).padStart(2, '0')}]`;
    t += `│ ${num} ${s.emoji} *${s.name}* ─── (${count} أمر)\n`;
  });
  t += `│\n╰────────────────────────────╯\n\n`;

  t += `💡 *أبرز الأوامر والتريندات الجديدة:*\n`;
  t += `▪️ لتصفح أي قسم: *${config.prefix}<رقم القسم>* (مثلاً: *${config.prefix}2* لقسم الرعب والغموض)\n`;
  t += `▪️ ريكوردات وترندات تيك توك: *${config.prefix}صوت_تيك <الاسم>* (مثلاً: *${config.prefix}صوت_تيك عايز حقي ناشف*)\n`;
  t += `▪️ محادثة ذكية بذاكرة مستمرة: *${config.prefix}شات <رسالتك>*\n`;
  t += `▪️ توليد صور سينمائية فائقة: *${config.prefix}تخيل <الوصف>* أو *${config.prefix}تخيل_انمي*\n`;
  t += `▪️ قصص وأصوات مرعبة: *${config.prefix}قصة_رعب* أو *${config.prefix}صوت_مرعب*\n`;
  t += `▪️ تبديل مودات البوت: *${config.prefix}مود* (رعب، سايبر، أنمي، فخامة)\n`;
  t += `▪️ تحميل فوري ميديا: *${config.prefix}ميديا <الرابط>*\n`;
  t += `▪️ تحويل النص لصوت طبيعي: *${config.prefix}صوت <النص>*\n\n`;
  t += `📢 *قناة التحديثات الرسمية:* ${config.channelLink}\n\n`;
  t += `${theme.decor} ──────────────────── ${theme.decor}\n`;
  t += `⚡ *${config.botName.toUpperCase()}* ⚡ سيرفر دائم ومستقر 24/7`;

  return t;
}

export function sectionMenu(num) {
  const s = sections[num - 1];
  if (!s) {
    return `❌ *رقم القسم غير صحيح!*\nاكتب *${config.prefix}اوامر* لعرض قائمة الأقسام من [01] إلى [${sections.length}].`;
  }

  const list = uniqueCommands().filter(c => c.section === s.key);

  let t = `╭───〔 ${s.emoji} *قسم ${s.name}* 〕───╮\n`;
  t += `│ 📖 ${s.desc}\n`;
  t += `│ 📦 إجمالي الأوامر: *${list.length}* أمر\n`;
  t += `╰────────────────────────────╯\n\n`;

  if (!list.length) {
    t += '🔸 لا توجد أوامر متوفرة في هذا القسم حالياً.';
    return t;
  }

  t += `╭───〔 📜 *الأوامر المتاحة* 〕───╮\n│\n`;
  t += list
    .map(c => {
      const tag = c.owner ? '👑' : c.admin ? '🛡️' : c.group ? '👥' : '🔹';
      const aliases = c.aliases && c.aliases.length ? ` [${c.aliases.slice(0, 2).join(', ')}]` : '';
      return `│ ${tag} *${config.prefix}${c.name}*${aliases}\n│    ↳ 💬 ${c.desc || '—'}`;
    })
    .join('\n│\n');

  t += `\n│\n╰────────────────────────────╯\n`;
  t += `📌 *دليل الرموز:*\n`;
  t += `👑 للمطور  |  🛡️ للأدمن فقط  |  👥 للمجموعات فقط\n`;
  t += `⚡ *${config.botName}*`;

  return t;
}
