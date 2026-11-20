import pino from 'pino';
import config from './config.js';
import { commands, uniqueCommands } from './lib/loader.js';
import { mainMenu, sectionMenu } from './lib/menu.js';
import { db, user, group, save } from './lib/db.js';
import { numOf, ids, randInt, money, normAr, getRank } from './lib/utils.js';
import { downloadMediaMessage } from './lib/baileys.js';
import { pushError } from './lib/logs.js';
import { games } from './lib/state.js';
import { getActiveTheme, getThemeBanner, getThemeReaction, isCardImageEnabled } from './lib/theme_engine.js';

const logger = pino({ level: 'silent' });
const metaCache = new Map();
const userCooldown = new Map();

// تنظيف دوري للذاكرة كل 10 دقائق لضمان استقرار البوت في مئات المجموعات
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of metaCache.entries()) {
    if (now - v.t > 120000) metaCache.delete(k);
  }
  for (const [k, t] of userCooldown.entries()) {
    if (now - t > 10000) userCooldown.delete(k);
  }
}, 600000);

export async function getMeta(sock, jid) {
  const c = metaCache.get(jid);
  if (c && Date.now() - c.t < 60000) return c.meta;
  try {
    const meta = await sock.groupMetadata(jid);
    metaCache.set(jid, { t: Date.now(), meta });
    return meta;
  } catch (e) {
    if (c?.meta) return c.meta; // استخدام آخر بيانات مخزنة عند حدوث Rate Limit
    throw e;
  }
}
export const clearMeta = jid => metaCache.delete(jid);

function unwrap(msg) {
  let x = msg;
  for (let i = 0; i < 4; i++) {
    const inner = x?.ephemeralMessage?.message || x?.viewOnceMessage?.message ||
      x?.viewOnceMessageV2?.message || x?.documentWithCaptionMessage?.message;
    if (!inner) break;
    x = inner;
  }
  return x;
}

const getCI = msg => {
  const k = Object.keys(msg || {}).find(t => msg[t]?.contextInfo);
  return k ? msg[k].contextInfo : null;
};

const textOf = msg =>
  msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption ||
  msg?.videoMessage?.caption || msg?.documentMessage?.caption || '';

const LINK_RE = /(https?:\/\/|chat\.whatsapp\.com|wa\.me\/)\S+/i;
const PREFIXES = [config.prefix, '.', '!', '#', '/'].filter(Boolean);

export async function handle(sock, m) {
  if (!m.message) return;
  m.message = unwrap(m.message);
  const text = textOf(m.message).trim();
  const isCmd = PREFIXES.some(p => text.startsWith(p)) || ['اوامر', 'الاوامر', 'menu', 'help'].includes(normAr(text));
  if (m.key.fromMe && !isCmd) return;
  const jid = m.key.remoteJid;
  if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;

  const isGroup = jid.endsWith('@g.us');
  const raw = (isGroup ? [m.key.participant, m.key.participantAlt] : [jid, m.key.remoteJidAlt]).filter(Boolean);
  let sender = raw.find(s => s.endsWith('@s.whatsapp.net')) || raw[0];
  const sn = raw.map(numOf);

  let meta = null, isAdmin = false, isBotAdmin = false;
  const pid = j => meta?.participants.find(p => ids(p).map(numOf).includes(numOf(j)))?.id || j;
  const partOf = j => meta?.participants.find(p => ids(p).map(numOf).includes(numOf(j))) || null;
  const canon = j => {
    const p = partOf(j);
    return p ? (p.phoneNumber || p.jid || (p.id.endsWith('@s.whatsapp.net') ? p.id : j)) : j;
  };

  if (isGroup) {
    try { meta = await getMeta(sock, jid); } catch { return; }
    const sp = partOf(sender) || meta.participants.find(p => ids(p).map(numOf).some(n => sn.includes(n)));
    if (sp) { isAdmin = !!sp.admin; sender = canon(sp.id); sn.push(numOf(sender)); }
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(numOf);
    isBotAdmin = !!meta.participants.find(p => ids(p).map(numOf).some(n => me.includes(n)))?.admin;
  }

  const isOwner = sn.some(n => config.owners.includes(n));
  const assistantData = db.settings.assistants?.[sender] || db.settings.assistants?.[numOf(sender) + '@s.whatsapp.net'] || null;
  const isAssistant = Boolean(assistantData);
  const assistantPerms = assistantData?.perms || [];

  const isBanned = (db.settings.banned || []).some(b => sn.includes(numOf(b)) || b === sender || b === numOf(sender));
  if (!isOwner && isBanned) return;
  if (!isOwner && !isAssistant && db.settings.mode === 'private') return;

  const ci = getCI(m.message);
  const mentioned = (ci?.mentionedJid || []).map(canon);
  const u = user(sender);
  const g = isGroup ? group(jid) : null;

  const reply = (t, mentions) => {
    console.log(`📤 [إرسال رد] إلى: ${jid} | المحتوى: ${String(t).slice(0, 30)}...`);
    const activeTheme = getActiveTheme();
    if (isCardImageEnabled()) {
      const banner = getThemeBanner();
      const payload = {
        text: t,
        contextInfo: {
          externalAdReply: {
            title: activeTheme.title,
            body: activeTheme.subtitle,
            thumbnailUrl: banner,
            sourceUrl: 'https://whatsapp.com',
            mediaType: 1,
            renderLargerThumbnail: true,
          },
        },
      };
      if (mentions) payload.mentions = mentions;
      return sock.sendMessage(jid, payload, { quoted: m });
    }
    return sock.sendMessage(jid, mentions ? { text: t, mentions } : { text: t }, { quoted: m });
  };
  const send = content => sock.sendMessage(jid, content, { quoted: m });
  const react = emoji => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {});

  // ===== حماية المجموعات (قبل الأوامر) =====
  if (isGroup && !isAdmin && !isOwner) {
    if (g.frozen && isBotAdmin) {
      await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
      return;
    }
    const gBad = db.settings.globalBadwords || [];
    if (gBad.some(w => text.toLowerCase().includes(w))) {
      if (isBotAdmin) await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
      return;
    }
    if (g.muted.includes(numOf(sender))) {
      if (isBotAdmin) await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
      return;
    }
    if (g.antilink && LINK_RE.test(text)) {
      if (isBotAdmin) {
        await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
        await reply(`╭━━━〔 ⚠️ *تنبيه أمني* 〕━━━╮\n│\n│ 🚫 عذراً يا @${numOf(sender)}، إرسال الروابط ممنوع!\n│ 🗑️ تم حذف الرسالة تلقائياً.\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`, [sender]);
      }
      return;
    }
    if (g.badwords.length && g.badwords.some(w => text.includes(w))) {
      if (isBotAdmin) {
        await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
        const k = numOf(sender);
        g.warns[k] = (g.warns[k] || 0) + 1;
        const n = g.warns[k];
        let msg = `╭━━━〔 ⚠️ *كلمة محظورة* 〕━━━╮\n│\n│ 🚫 تم حذف رسالتك يا @${k} لاحتوائها على لفظ ممنوع!\n│ ⚠️ تحذير: *${n} / 3*\n`;
        if (n >= 3) {
          await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
          delete g.warns[k];
          msg += `│ 👢 تم طردك تلقائياً لتجاوزك الحد الأقصى للتحذيرات.\n`;
        }
        msg += `│\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
        save();
        await reply(msg, [sender]);
      }
      return;
    }
  }

  // ===== تفقد الغياب (AFK) =====
  if (u.afk && !text.includes('غياب')) {
    u.afk = null;
    save();
    reply(`👋 مرحباً بعودتك يا @${numOf(sender)}! تم إلغاء وضع الغياب عن حسابك.`, [sender]);
  }

  // إشعار بالغياب عند المنشن أو الرد
  const afkCheck = [...mentioned];
  if (ci?.participant) afkCheck.push(canon(ci.participant));
  for (const j of new Set(afkCheck)) {
    if (numOf(j) === numOf(sender)) continue;
    const t = db.users[numOf(j)];
    if (t?.afk) {
      reply(`╭━━━〔 💤 *العضو في وضع الغياب* 〕━━━╮\n│\n│ 👤 @${numOf(j)} غير متاح حالياً.\n│ 📝 السبب: *${t.afk.reason}*\n│ ⏱️ منذ: *${Math.round((Date.now() - t.afk.since) / 60000)}* دقيقة\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`, [j]);
    }
  }

  // ===== فحص إجابات الألعاب التفاعلية بدون بادئة =====
  if (isGroup && games.has(jid) && text) {
    const activeGame = games.get(jid);
    if (activeGame && activeGame.until > Date.now()) {
      if (activeGame.type === 'guess') {
        const n = parseInt(text.trim());
        if (!isNaN(n) && n >= 1 && n <= 20) {
          activeGame.tries--;
          if (n === activeGame.answer) {
            games.delete(jid);
            const prize = randInt(100, 200);
            u.money += prize;
            save();
            return reply(`╭━━━〔 🎯 *إجابة صحيحة!* 〕━━━╮\n│\n│ 👤 أحسنت يا @${numOf(sender)}!\n│ 🔢 الرقم الصحيح هو: *${activeGame.answer}*\n│ 💰 جائزتك: *+${money(prize)}* 💵\n│ 👛 رصيدك الآن: *${money(u.money)}* 💵\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`, [sender]);
          } else if (activeGame.tries <= 0) {
            games.delete(jid);
            return reply(`╭━━━〔 ⌛ *انتهت المحاولات!* 〕━━━╮\n│\n│ ❌ لم يتمكن أحد من تخمين الرقم.\n│ 🔢 الرقم الصحيح كان: *${activeGame.answer}*\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
          } else {
            return reply(`╭━━━〔 🔢 *تخمين غير صحيح* 〕━━━╮\n│\n│ ${n < activeGame.answer ? '⬆️ الرقم المطلوب *أكبر* من ذلك!' : '⬇️ الرقم المطلوب *أصغر* من ذلك!'}\n│ 🎯 متبقي: *${activeGame.tries}* محاولات\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
          }
        }
      } else if (activeGame.answers && activeGame.answers.some(a => normAr(a) === normAr(text))) {
        games.delete(jid);
        const prize = randInt(80, 160);
        u.money += prize;
        save();
        return reply(`╭━━━〔 🎉 *إجابة صحيحة وسريعة!* 〕━━━╮\n│\n│ 👏 إجابة عبقرية يا @${numOf(sender)}!\n│ 💰 ربحت معنا: *+${money(prize)}* 💵\n│ 👛 رصيدك الآن: *${money(u.money)}* 💵\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`, [sender]);
      }
    } else if (activeGame && activeGame.until <= Date.now()) {
      games.delete(jid);
    }
  }

  // ===== نقاط الخبرة والمستويات =====
  u.msgs = (u.msgs || 0) + 1;
  if (Date.now() - (u.lastXp || 0) > 15000) {
    u.lastXp = Date.now();
    u.xp = (u.xp || 0) + randInt(3, 8);
    const lv = Math.floor(Math.sqrt(u.xp / 50)) + 1;
    if (lv > (u.level || 1)) {
      u.level = lv;
      const bonus = lv * 100;
      u.money += bonus;
      if (isGroup) {
        reply(`╭━━━〔 🎊 *ترقية مستوى جديدة!* 〕━━━╮\n│\n│ 🌟 مبروك يا @${numOf(sender)}!\n│ 🆙 ارتقيت إلى المستوى: *Lv.${lv}*\n│ 🎖️ رتبتك الآن: *${getRank(lv)}*\n│ 🎁 مكافأة الترقية: *+${money(bonus)}* 💵\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`, [sender]);
      }
    }
  }
  save();

  const sendMainMenu = async () => {
    const startMsgTime = m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now() - 40;
    const latency = Math.max(15, Math.min(300, Math.abs(Date.now() - startMsgTime)));
    const menuContent = mainMenu(m.pushName || 'صديقي', u, latency);
    const banner = getThemeBanner();
    try {
      return await sock.sendMessage(jid, {
        image: { url: banner },
        caption: menuContent,
      }, { quoted: m });
    } catch {}
    return reply(menuContent);
  };

  // فحص فتح القائمة أو مناداة البوت بدون بادئة
  const normText = normAr(text);
  if (['اوامر', 'الاوامر', 'menu', 'help', 'قائمة', 'القائمة'].includes(normText)) {
    return sendMainMenu();
  }

  if (['بوت', 'bot', 'نو_اند_نو'].includes(normText)) {
    const theme = getActiveTheme();
    const banner = getThemeBanner();
    const botText = `╭───〔 ${theme.title} 〕───╮\n│\n` +
      `│ ${theme.decor} أهلاً بك يا *${m.pushName || 'صديقي'}* في ${theme.name}!\n` +
      `│ ⚡ البوت يعمل 24/7 بأعلى استقرار وسرعة فائقة.\n│\n` +
      `│ 📜 اكتب *${config.prefix}اوامر* لتصفح كافة الأقسام.\n` +
      `│ 🎭 اكتب *${config.prefix}مود* لتغيير شكل وثيم البوت (رعب، سايبر، أنمي، فخامة).\n` +
      `│ 🎙️ اكتب *${config.prefix}صوت_تيك <الاسم>* لريكوردات وتريندات التيك توك.\n` +
      `│ 🧠 اكتب *${config.prefix}شات <رسالتك>* لمحادثة ذكية مع حفظ الذاكرة.\n` +
      `│ 🎨 اكتب *${config.prefix}تخيل <الوصف>* لتوليد صور بجودة سينمائية.\n` +
      `│ 💀 اكتب *${config.prefix}قصة_رعب* أو *.صوت_مرعب* لقسم الرعب.\n│\n` +
      `╰────────────────────────────╯`;
    try {
      return await sock.sendMessage(jid, {
        image: { url: banner },
        caption: botText,
      }, { quoted: m });
    } catch {
      return reply(botText);
    }
  }

  // تحديد البادئة المستخدمة
  let usedPrefix = null;
  for (const p of PREFIXES) {
    if (text.startsWith(p)) {
      usedPrefix = p;
      break;
    }
  }
  if (!usedPrefix) return;

  const rawArgs = text.slice(usedPrefix.length).trim().split(/\s+/);
  const name = (rawArgs.shift() || '').toLowerCase();
  if (!name) return;

  // فتح القسم مباشرة برقم مثل: .1 أو .8 أو /05
  if (/^\d{1,2}$/.test(name)) {
    const num = parseInt(name);
    if (num >= 1 && num <= 16) {
      return reply(sectionMenu(num));
    }
  }

  // عرض القوائم بالبادئة
  if (['اوامر', 'الاوامر', 'menu', 'help', 'قائمة', 'القائمة'].includes(name)) {
    return rawArgs[0] ? reply(sectionMenu(parseInt(rawArgs[0]))) : sendMainMenu();
  }

  // أمر البحث عن الأوامر
  if (['بحث', 'search', 'find'].includes(name)) {
    const q = rawArgs.join(' ').toLowerCase().trim();
    if (!q) return reply(`اكتب اسم الأمر أو جزء منه للبحث.\nمثال: *${usedPrefix}بحث استثمار*`);
    const all = uniqueCommands();
    const matched = all.filter(c =>
      c.name.includes(q) ||
      (c.aliases && c.aliases.some(a => a.includes(q))) ||
      (c.desc && c.desc.includes(q))
    );
    if (!matched.length) {
      return reply(`❌ لم يتم العثور على أي أمر يطابق: "*${q}*". اكتب *${usedPrefix}اوامر* لتصفح الأقسام.`);
    }
    let res = `╭━━━〔 🔍 *نتائج البحث عن:* "${q}" 〕━━━╮\n│\n`;
    res += matched.map(c => `│ ▫️ *${usedPrefix}${c.name}*\n│    ↳ ${c.desc || '—'}`).join('\n│\n');
    res += `\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
    return reply(res);
  }

  const cmd = commands.get(name);
  if (!cmd) return;

  if (!isOwner && (db.settings.disabled || []).includes(cmd.name)) {
    return reply('🚫 هذا الأمر معطّل مؤقتاً من قِبل إدارة البوت.');
  }

  if (cmd.owner && !isOwner) {
    let allowedForAssistant = false;
    if (isAssistant) {
      if (assistantPerms.includes('كاملة')) allowedForAssistant = true;
      else if (assistantPerms.includes('بث') && ['بث', 'بث_جروبات', 'broadcast', 'bc'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('طرد') && ['طرد', 'kick'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('حظر') && ['حظر', 'حظر_عام', 'gban', 'ban'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('قفل') && ['قفل_الجروب', 'فتح_الجروب', 'قفل_البوت', 'فتح_البوت'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('ريستارت') && ['اعادة_تشغيل', 'restart', 'ريستارت'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('تحديث') && ['حدث_نفسك', 'update_bot', 'تحديث_فوري'].includes(cmd.name)) allowedForAssistant = true;
      else if (assistantPerms.includes('انضمام') && ['انضمام', 'join', 'دخول', 'ادخل'].includes(cmd.name)) allowedForAssistant = true;
    }
    if (!allowedForAssistant) {
      return reply(isAssistant ? '⛔ ليس لديك الصلاحية المحددة لاستخدام هذا الأمر.' : '⛔ هذا الأمر مخصص لمطور البوت فقط.');
    }
  }

  if (cmd.group && !isGroup) return reply('⛔ هذا الأمر مخصص للمجموعات فقط.');
  if (cmd.admin && !(isAdmin || isOwner)) return reply('⛔ هذا الأمر مخصص لمشرفي المجموعة فقط.');
  if (cmd.botAdmin && !isBotAdmin) return reply('⚠️ يجب ترقية البوت لمشرف أولاً ليتمكن من تنفيذ هذا الأمر.');
  if (cmd.section === 'games' && isGroup && g.games === false) return reply('🎮 تم تعطيل الألعاب في هذه المجموعة من قِبل الأدمن.');

  // تحديد الهدف (منشن / رد / رقم)
  let tRaw = mentioned[0] || (ci?.participant ? canon(ci.participant) : null);
  const a0 = (rawArgs[0] || '').replace(/[\s+]/g, '');
  const numArg = /^\d{7,15}$/.test(a0);
  if (!tRaw && numArg) tRaw = a0 + '@s.whatsapp.net';
  const target = tRaw || null;
  const rest = (rawArgs[0]?.startsWith('@') || (numArg && target)) ? rawArgs.slice(1) : rawArgs;

  const quotedMsg = ci?.quotedMessage ? unwrap(ci.quotedMessage) : null;
  const quoted = quotedMsg ? { id: ci.stanzaId, participant: ci.participant, message: quotedMsg } : null;
  const quotedText = quotedMsg ? textOf(quotedMsg) : '';

  const getMedia = async (types = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'documentMessage']) => {
    let src = m, node = types.find(t => m.message[t]);
    if (!node && quotedMsg) {
      node = types.find(t => quotedMsg[t]);
      if (node) src = { key: { remoteJid: jid, id: ci.stanzaId, participant: ci.participant }, message: quotedMsg };
    }
    if (!node) return null;
    const buffer = await downloadMediaMessage(src, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
    return { buffer, type: node, mime: src.message[node]?.mimetype || '' };
  };

  const c = {
    sock, m, cmd, jid, sender, isGroup, isAdmin, isBotAdmin, isOwner, meta,
    args: rawArgs, text: rawArgs.join(' '), rest, restText: rest.join(' '),
    target, mentioned, quoted, quotedText, pushName: m.pushName || 'عضو',
    reply, send, react, getMedia, pid, partOf, u, g, prefix: usedPrefix,
    senderIds: [...new Set(sn)],
  };

  const SECTION_REACTIONS = {
    islamic: '🕌',
    ai: '🤖',
    games: '🎮',
    download: '📥',
    stickers: '🎨',
    bank: '💰',
    tools: '🛠️',
    members: '👤',
    admin: '🛡️',
    owner: '👑',
    groups: '👥',
    settings: '⚙️',
    extra: '✨',
  };

  // حماية ضد سبام الأوامر في المجموعات الكبيرة (1.2 ثانية كول داون لكل مستخدم عدا المطور)
  if (!isOwner && !isAssistant) {
    const userLastCmd = userCooldown.get(sender) || 0;
    const now = Date.now();
    if (now - userLastCmd < 1200) {
      return; // تجاهل الرسائل المكررة بسرعة فائقة لحماية السيرفر
    }
    userCooldown.set(sender, now);
  }

  try {
    const themeReaction = getThemeReaction();
    react(themeReaction || SECTION_REACTIONS[cmd.section] || '⚡');
    await cmd.run(c);
  } catch (e) {
    console.error(`خطأ في تشغيل الأمر ${name}:`, e);
    pushError(name, e);
    reply(`╭━━━〔 ⚠️ *تنبيه خطأ* 〕━━━╮\n│\n│ ❌ حدث خطأ أثناء تنفيذ الأمر:\n│ 📌 *${String(e.message || e).slice(0, 180)}*\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
  }
}
