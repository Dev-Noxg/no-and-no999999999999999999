import config from '../../config.js';

const CANDIDATE_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

// ذاكرة المحادثة المتعددة لكل شات/مستخدم (Multi-turn Memory)
const chatHistories = new Map();
const MAX_HISTORY = 16; // الاحتفاظ بآخر 16 رسالة لتوفير السياق دون تجاوز الحدود

function getHistory(chatId) {
  if (!chatHistories.has(chatId)) {
    chatHistories.set(chatId, []);
  }
  return chatHistories.get(chatId);
}

function clearHistory(chatId) {
  chatHistories.delete(chatId);
}

function addMessage(chatId, role, content) {
  const h = getHistory(chatId);
  h.push({ role, content, time: Date.now() });
  if (h.length > MAX_HISTORY) {
    h.splice(0, h.length - MAX_HISTORY);
  }
}

async function askFreePollinations(system, prompt, messages = []) {
  try {
    let full = system ? `${system}\n\n` : '';
    if (messages.length) {
      full += messages.map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`).join('\n');
      full += `\nالمستخدم: ${prompt}\nالمساعد:`;
    } else {
      full += prompt;
    }
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

export async function ask(system, prompt, history = []) {
  const { url, key } = config.ai;

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (history && history.length) {
    for (const h of history) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: 'user', content: prompt });

  if (key) {
    const modelsToTry = [...new Set([config.ai.model, ...CANDIDATE_MODELS])].filter(Boolean);
    for (const m of modelsToTry) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: m,
            messages,
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const ans = data?.choices?.[0]?.message?.content;
          if (ans) return ans.trim();
        }
      } catch {}
    }
  }

  // المحرك الاحتياطي المجاني الفوري
  const freeResp = await askFreePollinations(system, prompt, history);
  if (freeResp) return freeResp;

  return 'عذراً، لم أتمكن من معالجة الطلب في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً.';
}

// دالة ذكية لترجمة وتحسين وصف الصورة من العربي لإنجليزي سينمائي دقيق لضمان 100% تطابق
async function enrichPromptForImage(arabicPrompt) {
  try {
    const translationSystem = `You are an expert prompt engineer for Flux, Midjourney, and Stable Diffusion.
Translate the user's description into an ultra-detailed, vivid English prompt.
Focus on: subject, environment, lighting (cinematic, dramatic, volumetrics), texture, camera angle (8k, photorealistic or digital art style).
Rules: Output ONLY the enhanced English prompt. Do NOT write explanations, prefixes or quotes.`;

    const enriched = await ask(translationSystem, arabicPrompt);
    if (enriched && enriched.length > 5 && !enriched.includes('عذراً')) {
      return enriched.replace(/^["']|["']$/g, '').trim();
    }
  } catch {}
  return arabicPrompt;
}

const SYS_DEFAULT = 'أنت مساعد ذكي مدمج داخل بوت واتساب "no and no". تجيب بلباقة وذكاء ودقة وتنسيق جميل وبلهجة مصرية مهذبة أو فصحى حسب رغبة المستخدم.';

const need = (reply, ex) => reply(`💡 اكتب النص أو السؤال بعد الأمر مباشرة، أو قم بالرد على رسالة.\nمثال: *${ex}*`);

export default [
  // 1. شات تفاعلي يتذكر المحادثة السابقة (Multi-turn Chat)
  {
    name: 'شات',
    aliases: ['chat', 'دردشة', 'تكلم', 'سولف'],
    desc: 'محادثة تفاعلية مستمرة مع الذكاء الاصطناعي يتذكر فيها كلامك السابق',
    async run({ jid, text, quotedText, reply, react, sender, pushName }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/شات عامل إيه يا صاحبي؟');
      await react('🧠');

      const chatId = jid; // الذاكرة لكل محادثة (مجموعة أو خاص)
      const history = getHistory(chatId);

      const persona = 'أنت صديق ذكي ومرح وخبير مدمج داخل بوت واتساب "no and no". تذكر ما قاله المستخدم في الرسائل السابقة وتحدث معه كصديق حقيقي بتنسيق مرتب.';
      const answer = await ask(persona, q, history);

      // حفظ في الذاكرة
      addMessage(chatId, 'user', q);
      addMessage(chatId, 'assistant', answer);

      await reply(`╭───〔 🧠 *محادثة ذكية - NO & NO* 〕───╮\n\n${answer}\n\n╰────────────────────────────╯\n💡 _اكتب *.مسح_الشات* لبدء محادثة جديدة ونسيان السياق._`);
      await react('💬');
    },
  },

  // 2. مسح ذاكرة الشات
  {
    name: 'مسح_الشات',
    aliases: ['clearchat', 'reset_chat', 'نسيان_الشات', 'تفريغ_الشات'],
    desc: 'مسح وتفريغ ذاكرة محادثة الذكاء الاصطناعي وبدء شات جديد',
    async run({ jid, reply, react }) {
      await react('🧹');
      clearHistory(jid);
      reply(`╭───〔 🧹 *تفريغ الذاكرة* 〕───╮\n│\n│ ✅ تم مسح ذاكرة الشات بنجاح!\n│ 🧠 الذكاء الاصطناعي الآن جاهز لموضوع جديد.\n│\n╰────────────────────────────╯`);
    },
  },

  // 3. ذاكرة الشات الحالية
  {
    name: 'ذاكرة_الشات',
    aliases: ['chat_memory', 'حالة_الشات'],
    desc: 'عرض عدد الرسائل المحفوظة في ذاكرة هذا الشات حالياً',
    async run({ jid, reply, react }) {
      await react('📊');
      const h = getHistory(jid);
      reply(`╭───〔 📊 *ذاكرة الشات الحالية* 〕───╮\n│\n│ 💬 عدد الرسائل المخزنة: *${h.length} / ${MAX_HISTORY}*\n│ 🧠 حالة الذاكرة: *${h.length > 0 ? 'نشطة ومتصلة' : 'فارغة'}*\n│ 💡 لمسح الذاكرة: *.مسح_الشات*\n│\n╰────────────────────────────╯`);
    },
  },

  // 4. اسأل (سؤال فوري بدون حفظ ذاكرة)
  {
    name: 'اسأل',
    aliases: ['ai', 'ask', 'بوت_ذكي', 'ذكاء'],
    desc: 'اسأل الذكاء الاصطناعي أي سؤال سريع ومباشر',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/اسأل ما هي نظرية النسبية باختصار؟');
      await react('🤖');
      const answer = await ask(SYS_DEFAULT, q);
      reply(`╭───〔 🤖 *الذكاء الاصطناعي* 〕───╮\n\n${answer}\n\n╰────────────────────────────╯`);
      await react('✅');
    },
  },

  // 5. تخيل (توليد الصور بدقة خارقة مع ترجمة وتحسين برومبت احترافي)
  {
    name: 'تخيل',
    aliases: ['imagine', 'dalle', 'رسم', 'صورة_ai'],
    desc: 'توليد ورسم صور بالذكاء الاصطناعي بجودة HD عبر Flux/Pollinations',
    async run({ text, quotedText, reply, react, sock, jid, m }) {
      const q = text || quotedText;
      if (!q) return reply('💡 اكتب وصف الصورة التي تريد توليدها بالذكاء الاصطناعي.\nمثال: */تخيل محارب سايبر بانك في شوارع طوكيو الممطرة*');
      await react('🎨');
      const waitNotice = await reply('⏳ جاري ترجمة وتحسين وصف الصورة ورسمها بالذكاء الاصطناعي، انتظر ثوانٍ معدودة...');

      try {
        // ترجمة وتحسين الوصف
        const enhancedEnglishPrompt = await enrichPromptForImage(q);
        const seed = Math.floor(Math.random() * 10000000);

        // المحاولة الأولى: Pollinations مع محرك Flux
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedEnglishPrompt)}?model=flux&width=1024&height=1024&nologo=true&seed=${seed}`;
        let res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        // المحاولة الثانية: إذا فشل flux، نجرب turbo
        if (!res.ok) {
          imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedEnglishPrompt)}?model=turbo&width=1024&height=1024&nologo=true&seed=${seed}`;
          res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        }

        if (!res.ok) throw new Error('تعذر جلب الصورة من خوادم الذكاء الاصطناعي');
        const buffer = Buffer.from(await res.arrayBuffer());

        await sock.sendMessage(jid, {
          image: buffer,
          caption: `╭───〔 🎨 *رسم الذكاء الاصطناعي - NO & NO* 〕───╮\n│\n│ 📝 *الوصف الأصلي:* ${q}\n│ ⚡ *الوصف الفني:* ${enhancedEnglishPrompt.slice(0, 90)}...\n│ 🔮 *المحرك:* Flux Ultra-HD\n│ 👑 *المطور:* no and no\n│\n╰────────────────────────────╯`,
        }, { quoted: m });
        await react('✨');
      } catch (e) {
        reply(`❌ تعذر توليد الصورة: ${e.message}\n💡 جرب وصفاً آخر أو أعد المحاولة بعد لحظات.`);
      }
    },
  },

  // 6. تخيل برو (سينمائي 4K)
  {
    name: 'تخيل_برو',
    aliases: ['imagine_pro', 'رسم_سينمائي'],
    desc: 'توليد صور سينمائية فائقة الواقعية 4K مع إضاءة احترافية',
    async run({ text, quotedText, reply, react, sock, jid, m }) {
      const q = text || quotedText;
      if (!q) return reply('💡 اكتب وصف الصورة السينمائية.\nمثال: */تخيل_برو قلعة مظلمة في قمة جبل وقت الغروب*');
      await react('🎬');
      await reply('⏳ جاري الرسم بدقة 4K Cinematic...');

      try {
        const enhanced = await enrichPromptForImage(q + ', 8k resolution, cinematic lighting, photorealistic, octane render, masterpiece');
        const seed = Math.floor(Math.random() * 10000000);
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}?model=flux-realism&width=1024&height=1024&nologo=true&seed=${seed}`;
        const res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('فشل جلب الصورة السينمائية');
        const buffer = Buffer.from(await res.arrayBuffer());

        await sock.sendMessage(jid, {
          image: buffer,
          caption: `╭───〔 🎬 *Cinematic AI 4K* 〕───╮\n│\n│ 🔮 *الفكرة:* ${q}\n│ 💎 *الجودة:* 4K Photorealistic\n│\n╰────────────────────────────╯`,
        }, { quoted: m });
        await react('🌟');
      } catch (e) {
        reply(`❌ تعذر التوليد: ${e.message}`);
      }
    },
  },

  // 7. مصحح الأكواد البرمجية
  {
    name: 'كود_مصحح',
    aliases: ['fix_code', 'صلح_كود', 'debug'],
    desc: 'فحص وتصحيح الأخطاء في أي كود برمجي (JS, Python, PHP, C++, إلخ)',
    async run({ text, quotedText, reply, react }) {
      const code = text || quotedText;
      if (!code) return need(reply, '/كود_مصحح const x = 5; x = 10;');
      await react('💻');
      const sys = `أنت مهندس برمجيات محترف وخبير تصحيح أخطاء (Senior Software Debugger).
افحص الكود البرمجي التالي، وحدد الأخطاء فيه، واشرح سبب الخطأ، ثم اكتب الكود المصحح كاملاً بطريقة منسقة.`;
      const ans = await ask(sys, code);
      reply(`╭───〔 💻 *مصحح الأكواد البرمجية* 〕───╮\n\n${ans}\n\n╰────────────────────────────╯`);
      await react('✅');
    },
  },

  // 8. مساعد الدراسة والحل
  {
    name: 'مساعد_دراسة',
    aliases: ['study', 'حل_واجب', 'معادلة', 'فيزياء'],
    desc: 'حل المسائل الرياضية والعلمية وشرح الدروس خطوة بخطوة',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/مساعد_دراسة حل المعادلة: 2x + 10 = 20');
      await react('📚');
      const sys = `أنت معلم وأستاذ متخصص في الرياضيات والعلوم. قم بحل المسألة أو السؤال بطريقة تعليمية مشروحة خطوة بخطوة مع تبسيط الشرح.`;
      const ans = await ask(sys, q);
      reply(`╭───〔 📚 *المعلم الذكي* 〕───╮\n\n${ans}\n\n╰────────────────────────────╯`);
      await react('🎓');
    },
  },

  // 9. تلخيص النصوص والمقالات
  {
    name: 'لخص',
    aliases: ['summarize', 'ملخص', 'تلخيص'],
    desc: 'تلخيص أي مقال أو نص طويل في نقاط رئيسية مركزة ومفيدة',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/لخص (ضع النص أو المقال الطويل هنا)');
      await react('📝');
      const sys = `أنت خبير تلخيص نصوص ومقالات. لخص النص التالي في نقاط واضحة وأساسية مع الحفاظ على أهم المعلومات دون تفريط.`;
      const ans = await ask(sys, q);
      reply(`╭───〔 📝 *ملخص النص* 〕───╮\n\n${ans}\n\n╰────────────────────────────╯`);
      await react('✅');
    },
  },

  // 10. شاعر الذكاء الاصطناعي
  {
    name: 'شاعر',
    aliases: ['شعر', 'قصيدة', 'ابيات'],
    desc: 'تأليف أبيات شعر وقصائد فصيحة أو عامية حول أي موضوع أو شخص',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/شاعر الصداقة والوفاء');
      await react('🖋️');
      const sys = `أنت شاعر عربي فصيح وبليغ. ألف أبيات شعرية موزونة ورائعة حول الموضوع المطلوب، واضبط أواخر الكلمات بتنسيق شعري جذاب.`;
      const ans = await ask(sys, q);
      reply(`╭───〔 🖋️ *ديوان الشعر العربي* 〕───╮\n\n${ans}\n\n╰────────────────────────────╯`);
      await react('📜');
    },
  },

  // 11. ترجمة ذكية بسياق احترافي
  {
    name: 'ترجم_ذكي',
    aliases: ['ai_trans', 'ترجمة_سياقية'],
    desc: 'ترجمة احترافية تراعي المعنى البلاغي والسياق الثقافي',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/ترجم_ذكي Break a leg!');
      await react('🌐');
      const sys = `أنت مترجم فوري محترف. ترجم العبارة بدقة وسياق طبيعي، وإذا كانت مثلاً شعبياً أو مصطلحاً idiomatic اشرح معناه المقصود.`;
      const ans = await ask(sys, q);
      reply(`╭───〔 🌐 *الترجمة السياقية الذكية* 〕───╮\n\n${ans}\n\n╰────────────────────────────╯`);
      await react('✅');
    },
  },
];
