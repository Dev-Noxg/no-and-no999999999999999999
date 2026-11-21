// ══════════════════════════════════════════════════════════════
// 📱 محرك الرسائل التفاعلية (Carousel Cards, Buttons & Native Lists)
// ══════════════════════════════════════════════════════════════

import { proto, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import config from '../config.js';

/**
 * إرسال رسالة كروت سلايدر (Carousel Slider) مع أزرار تفاعلية لكل كارت
 * @param {object} sock - اتصال Baileys
 * @param {string} jid - وجهة الرسالة
 * @param {object} options - الخيارات: { body, footer, cards }
 * @param {object} quoted - الرسالة المقتبسة
 */
export async function sendCarousel(sock, jid, { body = '', footer = config.botName, cards = [] }, quoted = null) {
  try {
    const protoCards = cards.map((c, idx) => {
      const buttons = (c.buttons || []).map(b => {
        if (b.type === 'cta_copy') {
          return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: b.display_text || 'نسخ',
              id: b.id || `copy_${idx}`,
              copy_code: b.copy_code || ''
            })
          };
        } else if (b.type === 'cta_url') {
          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: b.display_text || 'رابط',
              url: b.url || config.channelLink,
              merchant_url: b.url || config.channelLink
            })
          };
        } else {
          // quick_reply
          return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: b.display_text || 'اختيار',
              id: b.id || b.command || `.اوامر`
            })
          };
        }
      });

      return {
        header: proto.Message.InteractiveMessage.Header.create({
          title: c.title || '',
          hasMediaAttachment: false
        }),
        body: proto.Message.InteractiveMessage.Body.create({
          text: c.body || c.description || ''
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
          text: c.footer || footer
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
          buttons
        })
      };
    });

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({ text: body }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards: protoCards
      })
    });

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage
        }
      }
    }, quoted ? { quoted } : {});

    return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  } catch (err) {
    console.log('⚠️ تعذر إرسال الكاروسيل التفاعلي، سيتم التحويل للنمط النصي الأنيق:', err.message);
    // وضع بديل أنيق
    let fallbackText = `╭━━━〔 📱 *${body || 'القائمة التفاعلية'}* 〕━━━╮\n│\n`;
    for (const c of cards) {
      fallbackText += `│ 🔹 *${c.title}*\n│    ${c.body || ''}\n`;
      if (c.buttons?.length) {
        fallbackText += `│    🔘 ${c.buttons.map(b => `[ ${b.display_text} ]`).join(' · ')}\n`;
      }
      fallbackText += `│\n`;
    }
    fallbackText += `╰━━━〔 ${footer} 〕━━━╯`;
    return sock.sendMessage(jid, { text: fallbackText }, quoted ? { quoted } : {});
  }
}

/**
 * إرسال رسالة أزرار تفاعلية عريضة (Action Buttons)
 */
export async function sendInteractiveButtons(sock, jid, { title = '', body = '', footer = config.botName, buttons = [] }, quoted = null) {
  try {
    const protoButtons = buttons.map(b => {
      if (b.type === 'cta_copy') {
        return {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: b.display_text,
            copy_code: b.copy_code || ''
          })
        };
      } else if (b.type === 'cta_url') {
        return {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: b.display_text,
            url: b.url || config.channelLink
          })
        };
      }
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text,
          id: b.id || b.command || ''
        })
      };
    });

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create({
        title,
        hasMediaAttachment: false
      }),
      body: proto.Message.InteractiveMessage.Body.create({ text: body }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: protoButtons
      })
    });

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage
        }
      }
    }, quoted ? { quoted } : {});

    return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  } catch (err) {
    let fallback = `${title ? `*${title}*\n\n` : ''}${body}\n\n`;
    fallback += buttons.map(b => `🔘 *${b.display_text}* ${b.id ? `-> اكتب: ${b.id}` : ''}`).join('\n');
    return sock.sendMessage(jid, { text: fallback }, quoted ? { quoted } : {});
  }
}

/**
 * إرسال قائمة منسدلة منبثقة (Native Flow List Menu)
 */
export async function sendInteractiveList(sock, jid, { title = '', body = '', footer = config.botName, buttonText = 'اضغط لاختيار القسم 📜', sections = [] }, quoted = null) {
  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create({
        title,
        hasMediaAttachment: false
      }),
      body: proto.Message.InteractiveMessage.Body.create({ text: body }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: buttonText,
              sections
            })
          }
        ]
      })
    });

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage
        }
      }
    }, quoted ? { quoted } : {});

    return await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  } catch (err) {
    let fallback = `${title ? `*${title}*\n\n` : ''}${body}\n\n`;
    for (const sec of sections) {
      fallback += `📌 *${sec.title}*:\n`;
      for (const row of sec.rows || []) {
        fallback += `▫️ ${row.title}: ${row.description || ''} (اكتب: *${row.id}*)\n`;
      }
      fallback += '\n';
    }
    return sock.sendMessage(jid, { text: fallback }, quoted ? { quoted } : {});
  }
}
