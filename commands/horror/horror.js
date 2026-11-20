import { ask } from '../ai/ai.js';
import { getThemeBanner } from '../../lib/theme_engine.js';
import { rand, safeSendAudio } from '../../lib/utils.js';

const SCARY_SOUNDS = [
  'https://www.myinstants.com/media/sounds/scary-sound-effect.mp3',
  'https://www.myinstants.com/media/sounds/creepy-lullaby.mp3',
  'https://www.myinstants.com/media/sounds/evil-laugh.mp3',
  'https://www.myinstants.com/media/sounds/screaming-man.mp3',
  'https://www.myinstants.com/media/sounds/death-clock.mp3',
  'https://www.myinstants.com/media/sounds/ghost-whisper.mp3',
];

const JINN_ENTITIES = [
  { name: 'مارد الظلال (ماروت)', title: 'حارس المقابر المهجورة', curse: 'ستسمع صرير الباب يُفتح الليلة في تمام الساعة 3:00 فجراً وحدك!' },
  { name: 'عفريت الصدى (قندس)', title: 'سيد الهمسات الليلية', curse: 'إذا نظرت في المرآة في الظلام ستجد انعكاسك يبتسم قبلك!' },
  { name: 'سيدة الرداء القرمزي', title: 'شبح القلعة المفقودة', curse: 'احذر النظر خلفك حين تمشي بمفردك في الممر المظلم!' },
  { name: 'الكيان المجهول (X)', title: 'ملك الكوابيس الأبدية', curse: 'حلمك القادم لن يكون من نسج خيالك، بل من بوابتي!' },
];

export default [
  // 1. قصة رعب بالذكاء الاصطناعي
  {
    name: 'قصة_رعب',
    aliases: ['scary_story', 'رعب', 'حكاية_رعب'],
    desc: 'تأليف قصة رعب غامضة ومخيفة جداً بالذكاء الاصطناعي',
    async run({ text, reply, react, sock, jid, m }) {
      await react('🩸');
      const topic = text ? `حول الموضوع التالي: ${text}` : 'عن بيت مهجور في ريف مصر وأصوات غريبة من السرداب';
      await reply('⏳ جاري استحضار الأرواح ونسج قصة رعب دموية تحبس الأنفاس...');

      const sys = `أنت كاتب أدب رعب وغموض عبقري مثل ستيفن كينج وأحمد خالد توفيق.
اكتب قصة رعب مشوقة ومخيفة جداً باللغة العربية الفصحى مع تفاصيل حسية وصوتية ترعب القارئ. اضبط الخاتمة بنهاية صادمة غير متوقعة.`;
      const story = await ask(sys, `اكتب لي قصة رعب مخيفة ${topic}`);

      const banner = getThemeBanner('horror');
      const msg = `╭───〔 💀 *سلسلة قصص الرعب المظلمة* 💀 〕───╮\n│\n` +
        `│ 🩸 *عنوان القصة:* ${text || 'أسرار السرداب الملعون'}\n│\n` +
        `${story}\n│\n` +
        `╰────────────────────────────╯\n` +
        `⚠️ _لا تقرأ هذه القصة في غرفة مظلمة بمفردك!_`;

      try {
        await sock.sendMessage(jid, {
          image: { url: banner },
          caption: msg,
        }, { quoted: m });
      } catch {
        reply(msg);
      }
      await react('⚰️');
    },
  },

  // 2. صوت مرعب (Audio Jumpscare)
  {
    name: 'صوت_مرعب',
    aliases: ['scary_sound', 'صرخة_رعب', 'صوت_مخيف'],
    desc: 'إرسال مقطع صوتي مرعب جداً (همسات، صرخات، أو موسيقى رعب)',
    async run({ reply, react, sock, jid, m }) {
      await react('👁️');
      const soundUrl = rand(SCARY_SOUNDS);
      try {
        const res = await fetch(soundUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buf = Buffer.from(await res.arrayBuffer());
        await safeSendAudio(sock, jid, buf, { ptt: true }, m);
        await react('💀');
      } catch (e) {
        reply(`❌ فشل استدعاء الصوت المرعب: ${e.message}`);
      }
    },
  },

  // 3. صورة مرعبة مع أسطورة مظلمة
  {
    name: 'صورة_مرعبة',
    aliases: ['scary_pic', 'صورة_رعب'],
    desc: 'إرسال لوحة رعب فائقة الوضوح مع أسطورتها المخيفة',
    async run({ reply, react, sock, jid, m }) {
      await react('🌑');
      const banner = getThemeBanner('horror');
      const lore = `╭───〔 💀 *لوحة الكوابيس المظلمة* 💀 〕───╮\n│\n` +
        `│ 🩸 *الاسم:* شبح الكيان الأسود\n` +
        `│ 👁️ *المشاهدة:* تم التقاط هذا المشهد عبر بوابة الأبعاد المظلمة.\n` +
        `│ ⚠️ يُقال إن من يدقق في عيني الكيان لأكثر من 5 ثوانٍ يرى ظله يتحرك بمفرده!\n│\n` +
        `╰────────────────────────────╯`;
      await sock.sendMessage(jid, {
        image: { url: banner },
        caption: lore,
      }, { quoted: m });
      await react('🕯️');
    },
  },

  // 4. لعبة تحضير الجن والكيانات المظلمة (تفاعلية كوميدية)
  {
    name: 'تحضير_جن',
    aliases: ['استدعاء', 'جلسة_تحضير', 'عفريت'],
    desc: 'جلسة تحضير أرواح تفاعلية غامضة تكشف عن كابوسك القادم',
    async run({ sender, reply, react, sock, jid, m }) {
      await react('🕯️');
      const entity = rand(JINN_ENTITIES);
      const banner = getThemeBanner('horror');

      const ritual = `╭───〔 🕯️ *طقوس تحضير الأرواح* 🕯️ 〕───╮\n│\n` +
        `│ 🪔 تم إشعال الشموع السوداء وفتح الطلاسم...\n` +
        `│ 🌀 *الكيان المستحضر:* [ ${entity.name} ]\n` +
        `│ 🏷️ *الرتبة:* ${entity.title}\n` +
        `│ 🎯 *المستهدف في الجلسة:* @${sender.split('@')[0]}\n│\n` +
        `│ 📜 *رسالة الكيان لك:*\n` +
        `│ "${entity.curse}"\n│\n` +
        `╰────────────────────────────╯`;

      try {
        await sock.sendMessage(jid, {
          image: { url: banner },
          caption: ritual,
          mentions: [sender],
        }, { quoted: m });
      } catch {
        reply(ritual, [sender]);
      }
      await react('⛓️');
    },
  },

  // 5. لعبة حرب البقاء في المصحة المهجورة
  {
    name: 'حرب_الرعب',
    aliases: ['survival', 'هروب_الرعب'],
    desc: 'مغامرة بقاء نصية تفاعلية داخل قصر ملعون',
    async run({ args, reply, react }) {
      await react('🚪');
      const choice = (args[0] || '').toLowerCase();
      if (!choice || !['1', '2', '3'].includes(choice)) {
        return reply(`╭───〔 🚪 *مغامرة الهروب من القصر الملعون* 〕───╮\n│\n` +
          `│ 🩸 أنت الآن محاصر داخل ممر مظلم والدماء تقطر من السقف!\n` +
          `│ أمامك 3 أبواب غامضة لتختار منها:\n│\n` +
          `│ [1] 🚪 *الباب الأول:* تصدر منه همسات أطفال تبكي.\n` +
          `│ [2] 🚪 *الباب الثاني:* يعلوه قفل حديدي وريح باردة كالثلج.\n` +
          `│ [3] 🚪 *الباب الثالث:* ينبعث منه ضوء أحمر خافت ورائحة رماد.\n│\n` +
          `│ 💡 اكتب رقم الباب للاختيار: *.حرب_الرعب 1* أو *2* أو *3*\n` +
          `╰────────────────────────────╯`);
      }

      if (choice === '1') {
        reply(`😱 *الباب الأول:* فتحت الباب فوجدت دمية قديمة تلتفت نحوك بعينين حمراوين!\nركضت بأعجوبة ونجوت بخدوش طفيفة! (+200 كاش) 💰`);
      } else if (choice === '2') {
        reply(`❄️ *الباب الثاني:* كان طريق الخروج السري نحو حديقة القصر المغطاة بالضباب!\n🎉 مبروك! لقد نجوت من الكيان المظلم وفزت بـ *+500 كاش*! 🏆`);
      } else {
        reply(`💀 *الباب الثالث:* انزلقت في فخ أعدّه مارد الظلال واحتجزت في السرداب لساعة!\nخسرت 100 كاش لكنك ما زلت على قيد الحياة! 🩸`);
      }
    },
  },
];
