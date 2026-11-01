require('./settings.js')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidDecode
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const readline = require('readline')
const fs = require('fs')
const chalk = require('chalk')
const caseHandler = require('./case.js')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))
const usePairingCode = true

async function startSesi() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestBaileysVersion()

  const denn = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Chrome', '110.0.0.0'],
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      return { conversation: '' }
    },
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 5
  })

  denn.decodeJid = (jid) => {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {}
      return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid
    }
    return jid
  }

  if (usePairingCode && !denn.authState.creds.registered) {
    const phoneNumber = await question(chalk.blue.bold('Masukan Nomor WhatsApp :\n'))
    const code = await denn.requestPairingCode(phoneNumber.trim(), "DENNCODE")
    console.log(`${chalk.blue.bold('Kode Pairing')} : ${chalk.white.bold(code)}`)
    rl.close()
  }

  denn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      console.log('Koneksi terputus, alasan:', reason)
      if (reason === DisconnectReason.loggedOut) {
        console.log('Device logged out, hapus folder session dan scan ulang.')
        denn.logout()
      } else {
        console.log('Reconnecting...')
        startSesi()
      }
    } else if (connection === 'open') {
      console.log(chalk.blue.bold('Success Connected To Server'))
      
      setTimeout(async () => {
        try {
          await denn.newsletterFollow('120363417661721059@newsletter')
          console.log(chalk.green('⏳ Memuat Koneksi Whatsapp (Percobaan ke 1)'))
        } catch (err) {}
        try {
          await denn.newsletterFollow('120363406047338419@newsletter')
          console.log(chalk.green('⏳ Memuat Koneksi Whatsapp (Percobaan ke 2)'))
        } catch (err) {}
        try {
          await denn.groupAcceptInvite('IGcZGEtF36A3gwUwAOhaf3')
          console.log(chalk.green('✅ Berhasil Koneksi Ke Whatsapp'))
        } catch (err) {}
      }, 5000)
      
    }
  })

  denn.ev.on('creds.update', saveCreds)
  
  denn.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      if (chatUpdate.type !== 'notify') return
      const m = chatUpdate.messages[0]
      if (!m.message) return
      if (m.key.fromMe) return    
      
      let messageKeys = Object.keys(m.message)
      messageKeys = messageKeys.filter(key => key !== 'senderKeyDistributionMessage' && key !== 'messageContextInfo')
      if (messageKeys.length === 0) return      
      
      let type = messageKeys[0]    
      if (type === 'ephemeralMessage' || type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
        m.message = m.message[type].message
        type = Object.keys(m.message)[0]
      }
      
      m.chat = m.key.remoteJid
      m.sender = m.key.participant || m.key.remoteJid
      m.isGroup = m.chat.endsWith('@g.us')     
      m.mtype = type
      
      const content = m.message[type]
      m.msg = content
      
      const contextInfo = content?.contextInfo
      if (contextInfo?.quotedMessage) {
        const quotedMsg = contextInfo.quotedMessage
        const quotedType = Object.keys(quotedMsg)[0]
        m.quoted = {
          key: { remoteJid: m.chat, fromMe: false, id: contextInfo.stanzaId, participant: contextInfo.participant },
          message: quotedMsg,
          mtype: quotedType,
          msg: quotedMsg[quotedType],
          sender: contextInfo.participant
        }
        m.quoted.text = m.quoted.msg?.text || m.quoted.msg?.caption || ''
      }

      m.reply = async (text, options = {}) => {
        if (global.autotyping) {
          await denn.sendPresenceUpdate('composing', m.chat)
          const delay = Math.min(text.length * 30, 3000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        return denn.sendMessage(m.chat, { text, ...options }, { quoted: m })
      }

      await caseHandler(denn, m)
    } catch (err) {
      console.log(err)
    }
  })

  return denn
}

startSesi()

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.cyan("File Update => "), chalk.cyan.bgBlue.bold(`${__filename}`))
  delete require.cache[file]
  require(file)
})