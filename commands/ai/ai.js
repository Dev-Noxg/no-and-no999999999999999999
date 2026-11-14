import config from '../../config.js';

const CANDIDATE_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
  'qwen/qwen3.8-27b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
];

async function ask(system, prompt) {
  const { url, key } = config.ai;
  if (!key) {
    return `╭━━━〔 🤖 *تفعيل الذكاء الاصطناعي* 〕━━━╮\n│\n│ ℹ️ خدمة الذكاء الاصطناعي مجانية 100% وسريعة جداً!\n│ 🔑 للحصول على مفتاح فوري مجاني:\n│ 1. ادخل على: https://console.groq.com/keys\n│ 2. اضغط "Create API Key" وانسخ الرمز\n│ 3. أرسل الأمر التالي هنا في الشات:\n│ ▫️ */تعيين_مفتاح_ai <المفتاح_هنا>*\n│\n│ ⚡ وسيعمل الذكاء الاصطناعي فوراً لجميع الأوامر!\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
  }

  // ترتيب النماذج: النموذج المحدد في الإعدادات أولاً ثم النماذج الاحتياطية المتوفرة في Groq
  const modelsToTry = [...new Set([config.ai.model, ...CANDIDATE_MODELS])].filter(Boolean);
  let lastError = null;

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
      if (!r.ok) {
        const errMsg = j.error?.message || `HTTP ${r.status}`;
        lastError = new Error(errMsg);
        // في حالة كان الموديل غير متاح، يتم التبديل للموديل التالي تلقائياً
        if (errMsg.includes('does not exist') || errMsg.includes('access') || j.error?.code === 'model_not_found') {
          continue;
        }
        throw lastError;
      }
      return j.choices?.[0]?.message?.content?.trim() || 'لم يتم استلام أي إجابة.';
    } catch (e) {
      lastError = e;
      if (e.message?.includes('does not exist') || e.message?.includes('access')) {
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error('تعذر الوصول إلى نماذج الذكاء الاصطناعي.');
}

const SYS = 'أنت مساعد ذكي مدمج داخل بوت واتساب يدعى "no and no". أجب بذكاء، وبأسلوب منسق، وواضح، وباللغة العربية الفصحى أو اللهجة المطلوبة بإيجاز دون إطالة مملة.';

const need = (reply, ex) => reply(`💡 اكتب النص أو السؤال بعد الأمر مباشرة، أو قم بالرد على رسالة.\nمثال: *${ex}*`);

export default [
  { name: 'اسأل', aliases: ['ai', 'ask', 'بوت', 'ذكاء'], desc: 'اسأل الذكاء الاصطناعي أي سؤال في بالك',
    async run({ text, quotedText, reply, react }) {
      const q = text || quotedText;
      if (!q) return need(reply, '/اسأل ما هي نظرية النسبية باختصار؟');
      await react('🤖');
      const answer = await ask(SYS, q);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 🤖 *الذكاء الاصطناعي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },

  { name: 'لخص', aliases: ['summarize', 'تلخيص'], desc: 'تلخيص النصوص والمقالات الطويلة في نقاط موجزة',
    async run({ text, quotedText, reply, react }) {
      const t = text || quotedText;
      if (!t) return need(reply, '/لخص <نص المقال> أو قم بالرد على رسالة طويلة');
      await react('📝');
      const answer = await ask('لخّص هذا النص في نقاط أساسية مرتبة وواضحة جداً وبنفس لغة النص الأصلية.', t);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 📑 *ملخص النص* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },

  { name: 'ترجم_ذكي', aliases: ['aitranslate'], desc: 'ترجمة احترافية ذكية تفهم المعنى والسياق',
    async run({ args, quotedText, reply, react }) {
      const t = args.join(' ') || quotedText;
      if (!t) return need(reply, '/ترجم_ذكي The journey of a thousand miles begins with one step');
      await react('🌐');
      const answer = await ask('ترجم النص بدقة واحترافية عالية إلى العربية مع مراعاة السياق والأدب البلاغي، وأعد النص المترجم فقط بلا مقدمات.', t);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 🌐 *الترجمة الذكية* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },

  { name: 'صحح', aliases: ['fix', 'تدقيق'], desc: 'تصحيح الأخطاء الإملائية والنحوية وتنسيق العبارات',
    async run({ text, quotedText, reply, react }) {
      const t = text || quotedText;
      if (!t) return need(reply, '/صحح انا ذهبت الى المستشفى امس واشتريت دواء');
      await react('✍️');
      const answer = await ask('صحّح كافة الأخطاء الإملائية والنحوية وعلامات الترقيم في النص التالي، وأعد النص المصحح النهائي فقط بدون شروحات زائدة.', t);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 ✨ *النص بعد التدقيق* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },

  { name: 'اكتب', aliases: ['write', 'تاليف', 'كتابة'], desc: 'كتابة نصوص إبداعية، مقالات، شعر، أو رسائل رسمية',
    async run({ text, reply, react }) {
      if (!text) return need(reply, '/اكتب رسالة تهنئة رسمية لزميلي بمناسبة ترقيته');
      await react('💡');
      const answer = await ask('أنت كاتب محترف ومبدع. اكتب النص المطلوب بأعلى درجات البلاغة والتنسيق الجذاب.', text);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 🖋️ *النص الإبداعي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },

  { name: 'كود_ذكي', aliases: ['codeai', 'برمج', 'مبرمج_ذكي'], desc: 'كتابة وشرح الأكواد البرمجية بالذكاء الاصطناعي',
    async run({ text, reply, react }) {
      if (!text) return need(reply, '/كود_ذكي اكتب دالة بايثون لتحميل ملف من الإنترنت');
      await react('💻');
      const answer = await ask('أنت مهندس برمجيات محترف وخبير. اكتب كوداً برمجياً نظيفاً واشرحه بإيجاز باللغة العربية.', text);
      if (answer.includes('تفعيل الذكاء الاصطناعي')) return reply(answer);
      reply(`╭━━━〔 💻 *المبرمج الذكي* 〕━━━╮\n\n${answer}\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
    } },
];
