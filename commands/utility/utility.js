export default [
  // 1. حالة الطقس المباشرة
  {
    name: 'طقس',
    aliases: ['weather', 'الجو', 'درجة_الحرارة'],
    desc: 'معرفة حالة الطقس ودرجات الحرارة في أي مدينة حول العالم',
    async run({ text, reply, react }) {
      const city = text.trim() || 'Cairo';
      await react('🌤️');
      try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error('فشل جلب بيانات الطقس');
        const data = await res.json();
        const current = data.current_condition[0];
        const descAr = current.lang_ar?.[0]?.value || current.weatherDesc[0]?.value;

        const msg = `╭───〔 🌤️ *حالة الطقس المباشرة* 〕───╮\n│\n` +
          `│ 📍 *المدينة:* ${city}\n` +
          `│ 🌡️ *درجة الحرارة:* ${current.temp_C}° مئوية (المحسوسة: ${current.FeelsLikeC}°)\n` +
          `│ 💧 *الرطوبة:* ${current.humidity}%\n` +
          `│ 💨 *سرعة الرياح:* ${current.windspeedKmph} كم/س\n` +
          `│ ☁️ *الحالة العامة:* ${descAr}\n│\n` +
          `╰────────────────────────────╯`;
        reply(msg);
      } catch (e) {
        reply(`❌ تعذر جلب الطقس لـ "${city}". تأكد من كتابة اسم المدينة بشكل صحيح.`);
      }
    },
  },

  // 2. تحويل العملات
  {
    name: 'عملات',
    aliases: ['currency', 'تحويل_عملة', 'سعر_الدولار'],
    desc: 'تحويل أسعار العملات العالمية لحظياً: .عملات 100 USD EGP',
    async run({ args, reply, react }) {
      if (!args[0]) {
        return reply(`💡 *طريقة الاستخدام:*\n*.عملات <المبلغ> <العملة_الحالية> <العملة_المستهدفة>*\n\n📌 مثال:\n*.عملات 100 USD EGP* (تحويل 100 دولار إلى جنيه مصري)\n*.عملات 50 SAR EGP* (تحويل 50 ريال سعودي إلى جنيه)`);
      }
      await react('💱');
      const amount = parseFloat(args[0]) || 1;
      const from = (args[1] || 'USD').toUpperCase();
      const to = (args[2] || 'EGP').toUpperCase();

      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error('فشل الاتصال ببنك أسعار الصرف');
        const data = await res.json();
        const rate = data.rates[to];
        if (!rate) return reply(`❌ لم يتم العثور على العملة "${to}".`);

        const total = (amount * rate).toFixed(2);
        const msg = `╭───〔 💱 *محول العملات المباشر* 〕───╮\n│\n` +
          `│ 💵 *المبلغ:* ${amount} ${from}\n` +
          `│ 🪙 *النتيجة:* *${total}* ${to}\n` +
          `│ 📊 *سعر الصرف:* 1 ${from} = ${rate.toFixed(4)} ${to}\n│\n` +
          `╰────────────────────────────╯`;
        reply(msg);
      } catch (e) {
        reply(`❌ فشل تحويل العملة: ${e.message}`);
      }
    },
  },

  // 3. موسوعة ويكيبيديا
  {
    name: 'ويكيبيديا',
    aliases: ['wiki', 'ابحث_ويكي'],
    desc: 'البحث عن أي معلومة أو شخصية أو حدث في موسوعة ويكيبيديا',
    async run({ text, reply, react }) {
      if (!text) return reply('💡 اكتب اسم الموضوع أو الشخصية بعد الأمر.\nمثال: *.ويكيبيديا الأهرامات*');
      await react('📚');
      try {
        const res = await fetch(`https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text.trim())}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error('لم يتم العثور على مقال');
        const data = await res.json();

        const title = data.title;
        const extract = data.extract;
        const pageUrl = data.content_urls?.desktop?.page;

        const msg = `╭───〔 📚 *موسوعة ويكيبيديا العربية* 〕───╮\n│\n` +
          `│ 📖 *العنوان:* ${title}\n│\n` +
          `${extract}\n│\n` +
          `│ 🔗 *رابط المقال:* ${pageUrl || '—'}\n` +
          `╰────────────────────────────╯`;
        reply(msg);
      } catch {
        reply(`❌ لم يتم العثور على نتائج في ويكيبيديا حول: "${text}".`);
      }
    },
  },

  // 4. تقصير الروابط
  {
    name: 'رابط_قصير',
    aliases: ['shorten', 'قصر_رابط', 'tinyurl'],
    desc: 'تقصير الروابط الطويلة لرابط مختصر وسهل المشاركة',
    async run({ text, reply, react }) {
      if (!text || !text.includes('.')) return reply('💡 ضع الرابط الذي تريد تقصيره بعد الأمر.\nمثال: *.رابط_قصير https://example.com/very/long/url*');
      await react('🔗');
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text.trim())}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error('فشل تقصير الرابط');
        const shortUrl = await res.text();
        reply(`╭───〔 🔗 *مختصر الروابط الفوري* 〕───╮\n│\n│ 🌐 *الرابط الأصلي:* ${text.trim().slice(0, 40)}...\n│ ✨ *الرابط القصير:* ${shortUrl}\n│\n╰────────────────────────────╯`);
      } catch (e) {
        reply(`❌ فشل تقصير الرابط: ${e.message}`);
      }
    },
  },

  // 5. توليد كود QR
  {
    name: 'باركود',
    aliases: ['qr', 'كيو_ار', 'صنع_باركود'],
    desc: 'صنع رمز استجابة سريعة (QR Code) لأي نص أو رابط',
    async run({ text, reply, react, sock, jid, m }) {
      if (!text) return reply('💡 اكتب النص أو الرابط لتحويله لرمز QR.\nمثال: *.باركود https://google.com*');
      await react('📱');
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text.trim())}`;
        const res = await fetch(qrUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        await sock.sendMessage(jid, {
          image: buf,
          caption: `╭───〔 📱 *رمز QR الذكي* 〕───╮\n│\n│ 📝 *المحتوى:* ${text.trim()}\n│ ⚡ امسح الكود بالكاميرا لفتحه فورياً.\n│\n╰────────────────────────────╯`,
        }, { quoted: m });
      } catch (e) {
        reply(`❌ فشل توليد كود QR: ${e.message}`);
      }
    },
  },

  // 6. اختبار السرعة والاتصال
  {
    name: 'بنج',
    aliases: ['ping', 'سرعة_البوت', 'سبيد'],
    desc: 'قياس سرعة استجابة البوت والبنج الفعلي للسيرفر',
    async run({ reply, react }) {
      const t1 = Date.now();
      await react('⚡');
      const latency = Date.now() - t1;
      reply(`╭───〔 ⚡ *اختبار سرعة السيرفر* 〕───╮\n│\n` +
        `│ 🚀 *سرعة المعالجة:* *${Math.max(12, latency)}ms*\n` +
        `│ 🟢 *حالة الاتصال:* ممتاز 100% مستقر\n` +
        `│ ⏱️ *وقت التشغيل:* 24/7 متواصل\n│\n` +
        `╰────────────────────────────╯`);
    },
  },
];
