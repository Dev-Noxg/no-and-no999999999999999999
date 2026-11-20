import * as ns from '@whiskeysockets/baileys';

// يشتغل مع أي شكل للتصدير في المكتبة
const lib = ns.useMultiFileAuthState ? ns : (ns.default || ns);
const cands = [
  typeof lib.default === 'function' ? lib.default : (lib.makeWASocket || ns.default),
  ns.makeWASocket, ns.default?.default, ns.default?.makeWASocket,
];
export const makeWASocket = cands.find(f => typeof f === 'function');
export const makeCacheableSignalKeyStore = ns.makeCacheableSignalKeyStore || lib.makeCacheableSignalKeyStore;
export const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = lib;
