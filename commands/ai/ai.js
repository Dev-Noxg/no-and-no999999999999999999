import config from '../../config.js';

const CANDIDATE_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

async function askFreePollinations(system, prompt) {
  try {
    const full = system ? `${system}\n\nطلب المستخدم:\n${prompt}` : prompt;
    const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(full)}?model=openai&seed=${Date.now()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (r.ok) {
      const txt = (await r.text()).trim();
      if (txt && !txt.includes('Rate limit')) return txt;
    }
  } catch {}
  return null;
}

async function ask(system, prompt) {
  const { url, key } = config.ai;

  if (key) {
    const modelsToTry = [...new Set([config.ai.model, ...CANDIDATE_MODELS])].filter(Boolean);
    for (const m of modelsToTry) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        const j = await r.json();
        if (r.ok && j.choices?.[0]?.message?.content) {
          return j.choices[0].message.content.trim();
        }
      } catch {}
    }
  }

  // المحرك الاحتياطي المجاني الفوري السريع
  const freeResp = await askFreePollinations(system, prompt);
  if (freeResp) return freeResp;

  return 'عذراً، لم أتمكن من معالجة الطلب في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً.';
}

const SYS = 'أنت مساعد ذكي مدمج داخل بوت واتساب يدعى "no and no". أجب بذكاء، وبأسلوب منسق، وواضح، وباللغة العربية الفصحى أو اللهجة المطلوبة بإيجاز دون إطالة مملة.';

const need = (reply, ex) => reply(`💡 اكتب النص أو السؤال بعد الأمر مباشرة، أو قم بالرد على رسالة.\nمثال: *${ex}*`);

export default [
  {
    name: 'اسأل',
    aliases: ['ai', 'ask', 'بوت_ذكي', 'ذكاء'],
    desc: 'اسأل الذكاء الاصطناعي أي سؤال في بالك (مجاني فوري)',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/اسأل ما هي نظرية النسبية باختصار؟');
      await react('🤖');
      const answer = await ask(SYS, q);
      reply(`╭━━━〔 🤖 *الذكاء الاصطناعي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },

  {
    name: 'تخيل',
    aliases: ['imagine', 'dalle', 'رسم', 'صورة_ai'],
    desc: 'توليد ورسم صور بالذكاء الاصطناعي بجودة HD',
    async run({ text, quotedText, reply, react, sock, jid, m }) {
      const q = text || quotedText;
      if (!q) return reply('💡 اكتب وصف الصورة التي تريد توليدها بالذكاء الاصطناعي.\nمثال: */تخيل سيارة مستقبلية نيون في شوارع طوكيو*');
      await react('🎨');
      const waitNotice = await reply('⏳ جاري رسم وتوليد الصورة بالذكاء الاصطناعي، انتظر ثوانٍ معدودة...');
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=1024&height=1024&nologo=true&seed=${seed}`;
        const res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('فشل جلب الصورة من خادم الذكاء الاصطناعي');
        const buffer = Buffer.from(await res.arrayBuffer());
        await sock.sendMessage(jid, {
          image: buffer,
          caption: `╭━━━〔 🎨 *رسم الذكاء الاصطناعي* 〕━━━╮\n│\n│ 📝 *الوصف:* ${q}\n│ ⚡ *المحرك:* Pollinations AI HD\n│ 👑 *البوت:* ${config.botName}\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        }, { quoted: m });
        await react('✨');
      } catch (e) {
        await react('❌');
        reply(`❌ تعذر توليد الصورة: ${e.message}`);
      }
    },
  },

  {
    name: 'شات',
    aliases: ['chat', 'سولف', 'فضفض'],
    desc: 'محادثة ودية وخفيفة الظل مع الذكاء الاصطناعي',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/شات صباح الخير، عامل إيه؟');
      await react('💬');
      const answer = await ask('أنت صديق ذكي ومرح وخفيف الظل داخل واتساب. تحدّث بودية وخفة دم وذكاء بلهجة عربية عصرية مفهومة وممتعة.', q);
      reply(answer);
      await react('❤️');
    },
  },

  {
    name: 'لخص',
    aliases: ['summarize', 'تلخيص'],
    desc: 'تلخيص النصوص والمقالات الطويلة في نقاط موجزة',
    async run({ text, quotedText, reply, react }) {
      const t = text || quotedText;
      if (!t) return need(reply, '/لخص <نص المقال> أو قم بالرد على رسالة طويلة');
      await react('📝');
      const answer = await ask('لخّص هذا النص في نقاط أساسية مرتبة وواضحة جداً وبنفس لغة النص الأصلية.', t);
      reply(`╭━━━〔 📑 *ملخص النص* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },

  {
    name: 'ترجم_ذكي',
    aliases: ['aitranslate'],
    desc: 'ترجمة احترافية ذكية تفهم المعنى والسياق',
    async run({ args, quotedText, reply, react }) {
      const t = args.join(' ') || quotedText;
      if (!t) return need(reply, '/ترجم_ذكي The journey of a thousand miles begins with one step');
      await react('🌐');
      const answer = await ask('ترجم النص بدقة واحترافية عالية إلى العربية مع مراعاة السياق والأدب البلاغي، وأعد النص المترجم فقط بلا مقدمات.', t);
      reply(`╭━━━〔 🌐 *الترجمة الذكية* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },

  {
    name: 'صحح',
    aliases: ['fix', 'تدقيق'],
    desc: 'تصحيح الأخطاء الإملائية والنحوية وتنسيق العبارات',
    async run({ text, quotedText, reply, react }) {
      const t = text || quotedText;
      if (!t) return need(reply, '/صحح انا ذهبت الى المستشفى امس واشتريت دواء');
      await react('✍️');
      const answer = await ask('صحّح كافة الأخطاء الإملائية والنحوية وعلامات الترقيم في النص التالي، وأعد النص المصحح النهائي فقط بدون شروحات زائدة.', t);
      reply(`╭━━━〔 ✨ *النص بعد التدقيق* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },

  {
    name: 'اكتب',
    aliases: ['write', 'تاليف', 'كتابة'],
    desc: 'كتابة نصوص إبداعية، مقالات، شعر، أو رسائل رسمية',
    async run({ text, reply, react }) {
      if (!text) return need(reply, '/اكتب رسالة تهنئة رسمية لزميلي بمناسبة ترقيته');
      await react('💡');
      const answer = await ask('أنت كاتب محترف ومبدع. اكتب النص المطلوب بأعلى درجات البلاغة والتنسيق الجذاب.', text);
      reply(`╭━━━〔 🖋️ *النص الإبداعي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },

  {
    name: 'كود_ذكي',
    aliases: ['codeai', 'برمج', 'مبرمج_ذكي'],
    desc: 'كتابة وشرح الأكواد البرمجية بالذكاء الاصطناعي',
    async run({ text, reply, react }) {
      if (!text) return need(reply, '/كود_ذكي اكتب دالة بايثون لتحميل ملف من الإنترنت');
      await react('💻');
      const answer = await ask('أنت مهندس برمجيات محترف وخبير. اكتب كوداً برمجياً نظيفاً واشرحه بإيجاز باللغة العربية.', text);
      reply(`╭━━━〔 💻 *المبرمج الذكي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      await react('✅');
    },
  },
];
