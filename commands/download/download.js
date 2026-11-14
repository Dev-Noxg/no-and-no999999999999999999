            const r = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(text)}&type=video`, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) continue;
            const results = (await r.json()).slice(0, 5);
            const lines = results.map((v, i) => `[0${i + 1}] ${v.title} | ${Math.floor(v.lengthSeconds / 60)}:${String(v.lengthSeconds % 60).padStart(2, '0')} | https://youtu.be/${v.videoId}`);
            return reply('╭━━━〔 🔎 *نتائج بحث يوتيوب* 〕━━━╮\n\n' + lines.join('\n\n') + '\n\n╰━━━━━━━━━━━━━━━━━━━━━━╯');
          } catch { continue; }
        }
        reply('❌ تعذر البحث في يوتيوب حالياً.');
      }
    },
  },
  {
    name: 'معلومات_فيديو',
    aliases: ['vinfo'],
    desc: 'استخراج تفاصيل وإحصائيات أي فيديو عبر الرابط',
    async run({ text, reply }) {
      if (!isUrl(text)) return reply('اكتب رابط الفيديو.');
      try {
        const j = JSON.parse(await ytdlp(['--dump-single-json', '--no-playlist', '--skip-download', '--no-warnings', text], 90000));
        reply(`╭━━━〔 🎬 *بيانات الفيديو* 〕━━━╮\n│\n│ 📌 العنوان: *${j.title}*\n│ 👤 القناة: *${j.uploader || '-'}*\n│ ⏱️ المدة: *${j.duration_string || '-'}*\n│ 👁️ المشاهدات: *${money(j.view_count)}*\n│ 📅 التاريخ: *${j.upload_date || '-'}*\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
      } catch {
        // فولباك: Invidious
        const urlMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
        if (!urlMatch) return reply('❌ رابط يوتيوب غير صالح.');
        for (const inst of INVIDIOUS_INSTANCES) {
          try {
            const r = await fetch(`${inst}/api/v1/videos/${urlMatch[1]}`, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) continue;
            const j = await r.json();
            return reply(`╭━━━〔 🎬 *بيانات الفيديو* 〕━━━╮\n│\n│ 📌 العنوان: *${j.title}*\n│ 👤 القناة: *${j.author || '-'}*\n│ ⏱️ المدة: *${Math.floor(j.lengthSeconds / 60)}:${String(j.lengthSeconds % 60).padStart(2, '0')}*\n│ 👁️ المشاهدات: *${money(j.viewCount)}*\n│ 📅 التاريخ: *${j.publishedText || '-'}*\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`);
          } catch { continue; }
        }
        reply('❌ تعذر جلب معلومات الفيديو.');
      }
    },
  },
];

