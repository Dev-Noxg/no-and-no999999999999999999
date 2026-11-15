import { rand, randInt, numOf, money, fmtDur } from '../../lib/utils.js';
import { save, cooldown } from '../../lib/db.js';
import { games } from '../../lib/state.js';

const WORDS_TO_UNSCRAMBLE = [
  'مستشفى', 'تليفزيون', 'كمبيوتر', 'إسكندرية', 'أهرامات',
  'ميكانيكي', 'فراولة', 'صيدلية', 'موسوعة', 'تلسكوب',
  'جامعة', 'مهندس', 'طائرة', 'غواصة', 'صاروخ'
];

export default [
  {
    name: 'عجلة_الحظ',
    aliases: ['wheel', 'عجلة', 'دولاب'],
    desc: 'تدوير عجلة الحظ لكسب جوائز مالية ونقاط خبرة (كل 6 ساعات)',
    async run({ u, reply, react }) {
      const left = cooldown(u, 'lucky_wheel', 6 * 3600000);
      if (left) return reply(`⏳ عجلة الحظ قيد الانتظار! عُد بعد: *${fmtDur(left)}*`);
      await react('🎡');
      const PRIZES = [
        { label: '💰 500 كاش', money: 500, xp: 20 },
        { label: '💰 1,000 كاش', money: 1000, xp: 50 },
        { label: '🌟 100 XP خبرة', money: 100, xp: 100 },
        { label: '🔥 2,500 كاش كبرى!', money: 2500, xp: 150 },
        { label: '💎 5,000 الجائزة الذهبية!', money: 5000, xp: 300 },
        { label: '😢 حظ أوفر في المرة القادمة', money: 0, xp: 5 },
      ];
      const win = rand(PRIZES);
      u.money += win.money;
      u.xp += win.xp;
      save();
      reply(`╭━━━〔 🎡 *عجلة الحظ الكبرى* 〕━━━╮\n│\n│ 🎯 استقرت العجلة على:\n│ ✨ *${win.label}*\n│\n│ 👛 رصيدك الآن: *${money(u.money)}* 💵\n│ 🌟 خبرتك الآن: *${u.xp}* XP\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
    },
  },

  {
    name: 'تفكيك',
    aliases: ['unscramble', 'فكك'],
    desc: 'لعبة تفكيك الكلمة إلى حروف منفصلة',
    group: true,
    async run({ jid, reply, react }) {
      const word = rand(WORDS_TO_UNSCRAMBLE);
      const broken = word.split('').join(' ');
      games.set(jid, {
        type: 'trivia',
        answers: [broken, word.split('').join('-'), word.split('').join(',')],
        until: Date.now() + 60000,
        prize: randInt(150, 300),
      });
      await react('🧩');
      reply(`╭━━━〔 🧩 *لعبة تفكيك الكلمات* 〕━━━╮\n│\n│ 🔤 فكك الكلمة التالية بحروف مفصولة بمسافة:\n│ 👉 *[ ${word} ]*\n│\n│ 💡 اكتب الحروف مفصولة في الشات، مثال: "ك ت ا ب"\n│ 💰 الجائزة: *150 - 300* 💵\n│ ⏳ الوقت: دقيقة واحدة\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
    },
  },

  {
    name: 'روليت',
    aliases: ['roulette', 'رصاصة'],
    desc: 'لعبة الروليت الروسية: جرب حظك مع المسدس (6 طلقات)',
    async run({ u, reply, react }) {
      await react('🔫');
      const chamber = randInt(1, 6);
      if (chamber === 6) {
        const loss = Math.min(u.money, 300);
        u.money -= loss;
        save();
        reply(`╭━━━〔 💥 *طااااخ!* 〕━━━╮\n│\n│ 💀 خرجت الرصاصة وأصابتك!\n│ 💸 دفعت تكاليف علاج بالمستشفى: *-${money(loss)}* 💵\n│ 👛 رصيدك الآن: *${money(u.money)}* 💵\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
      } else {
        const reward = 200;
        u.money += reward;
        save();
        reply(`╭━━━〔 🎯 *كلييييك!* 〕━━━╮\n│\n│ 😅 الحجرة كانت فارغة ونجوت بحياتك!\n│ 💰 مكافأة شجاعة: *+${money(reward)}* 💵\n│ 👛 رصيدك الآن: *${money(u.money)}* 💵\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`);
      }
    },
  },
];
