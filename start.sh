#!/bin/bash
# تثبيت yt-dlp إذا مش موجود
if ! command -v yt-dlp &> /dev/null; then
  echo "⬇️ جاري تثبيت yt-dlp..."
  curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod +x /usr/local/bin/yt-dlp
  echo "✅ تم تثبيت yt-dlp بنجاح"
fi

exec node index.js
