const fs = require('fs')
const os = require('os')
const util = require('util')
const chalk = require('chalk')
const axios = require('axios')
const yts = require('yt-search')
const sharp = require('sharp')
const AdmZip = require('adm-zip')
const ffmpeg = require('fluent-ffmpeg')
const FormData = require('form-data')
const googleTTS = require('google-tts-api')
const { exec } = require('child_process')
const { Sticker, StickerTypes } = require('wa-sticker-formatter')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
const { ImageUploadService } = require('node-upload-images')

if (!global.db) global.db = {}
if (!global.db.banned) global.db.banned = []
if (global.db.public === undefined) global.db.public = true

const clockString = (ms) => {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':')
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

module.exports = async (denn, m) => {
  try {
    const body = m.mtype === 'conversation' ? m.message.conversation
      : m.mtype === 'imageMessage' ? m.message.imageMessage.caption
      : m.mtype === 'videoMessage' ? m.message.videoMessage.caption
      : m.mtype === 'extendedTextMessage' ? m.message.extendedTextMessage.text
      : ''

    if (!body) return
    if (global.db.banned.includes(m.sender)) return

    const prefixMatch = body.match(/^[^a-zA-Z0-9\s]/)
    if (!prefixMatch) return   
    const prefix = prefixMatch[0]
    const args = body.slice(prefix.length).trim().split(/ +/)
    const command = args.shift()?.toLowerCase()
    if (!command) return
    const text = args.join(' ')
    
    const isOwner = m.sender.split('@')[0] === global.owner || m.key.fromMe
    const botNumber = await denn.decodeJid(denn.user.id)

    if (!global.db.public && !isOwner) return

    if (global.randomreact && command) {
      try {
        const emojis = ['🔥', '⚡', '👍', '😂', '✨', '💀', '🤖', '👀']
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
        if (Math.random() < 0.4) {
          await denn.sendMessage(m.chat, { react: { text: randomEmoji, key: m.key } })
        }
      } catch (err) {
        console.error('Gagal memberikan react:', err)
      }
    }

    const quoted = m.quoted ? m.quoted : m
    const mime = (quoted.msg || quoted).mimetype || ''
    const qmsg = (quoted.msg || quoted)

    const cleanJid = (jid) => jid ? String(jid).split(':')[0].split('@')[0] : ''

    const checkAdmin = async () => {
      if (!m.isGroup) return { isAdmin: false, isBotAdmin: false }
      const metadata = await denn.groupMetadata(m.chat)
      const sender = metadata.participants.find(p => cleanJid(p.id) === cleanJid(m.sender) || (p.lid && cleanJid(p.lid) === cleanJid(m.sender)))
      const bot = metadata.participants.find(p => cleanJid(p.id) === cleanJid(botNumber) || (p.lid && cleanJid(p.lid) === cleanJid(botNumber)))
      return { 
        isAdmin: sender?.admin === 'admin' || sender?.admin === 'superadmin', 
        isBotAdmin: bot?.admin === 'admin' || bot?.admin === 'superadmin' 
      }
    }

    const getBuffer = async (message, type) => {
      const stream = await downloadContentFromMessage(message, type)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }
      return buffer
    }

    const getTarget = () => {
      let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || (text ? text.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null)
      return target || null
    }

    console.log(chalk.white.bgCyan.bold(global.namabot), chalk.blue.bold(`[ PESAN ]`), chalk.blue.bold(`DARI`), chalk.blue.bold(`${m.sender.split("@")[0]}`), chalk.blue.bold(`Text :`), chalk.blue.bold(`${prefix + command}`))

    switch (command) {
      case 'menu':
      case 'help': {
        const uptime = clockString(process.uptime() * 1000)
        const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const jam = new Date().toLocaleTimeString('id-ID')
        const totalFitur = fs.readFileSync(__filename, 'utf-8').match(/case '/g)?.length || 0
   
        const ram = `${formatSize(os.totalmem() - os.freemem())} / ${formatSize(os.totalmem())}`
        const platform = os.platform()
        
        const menu = `
╭───〔 *${global.namabot}* 〕───
│ *⏰ Jam:* ${jam}
│ *📅 Tgl:* ${tanggal}
│ *⚡ Uptime:* ${uptime}
│ *📊 Total Fitur:* ${totalFitur}+
│ *💻 OS:* ${platform}
│ *🧠 RAM:* ${ram}
│ *👤 User:* ${m.pushName || 'User'}
│ *🌐 Mode:* ${global.db.public ? 'Public' : 'Self'}
│ *🤖 AutoTyping:* ${global.autotyping ? 'ON' : 'OFF'}
│ *✨ RandomReact:* ${global.randomreact ? 'ON' : 'OFF'}
╰─────────────────

┏━━━〔 *MAIN MENU* 〕━━━┓
┃ ➤ ${prefix}menu
┃ ➤ ${prefix}ping
┃ ➤ ${prefix}owner
┃ ➤ ${prefix}script
┗━━━━━━━━━━━━━━━━

┏━━━〔 *CONVERT & TOOLS* 〕━━━┓
┃ ➤ ${prefix}stiker
┃ ➤ ${prefix}wm <pack>|<author>
┃ ➤ ${prefix}toimg (reply stiker)
┃ ➤ ${prefix}tovid (reply stiker)
┃ ➤ ${prefix}tourl
┃ ➤ ${prefix}tts <teks>
┃ ➤ ${prefix}rvo (reply vn)
┃ ➤ ${prefix}gitclone <url>
┗━━━━━━━━━━━━━━━━

┏━━━〔 *DOWNLOADER* 〕━━━┓
┃ ➤ ${prefix}play <judul>
┃ ➤ ${prefix}ytmp3 <url>
┃ ➤ ${prefix}ytmp4 <url>
┃ ➤ ${prefix}tiktok <url>
┃ ➤ ${prefix}ig <url>
┗━━━━━━━━━━━━━━━━

┏━━━〔 *GROUP MENU* 〕━━━┓
┃ ➤ ${prefix}kick @tag
┃ ➤ ${prefix}add 628xxx
┃ ➤ ${prefix}promote @tag
┃ ➤ ${prefix}demote @tag
┃ ➤ ${prefix}tagall
┃ ➤ ${prefix}hidetag
┃ ➤ ${prefix}linkgc
┃ ➤ ${prefix}setname
┃ ➤ ${prefix}setdesc
┗━━━━━━━━━━━━━━━━

┏━━━〔 *OWNER MENU* 〕━━━┓
┃ ➤ ${prefix}pushkontak
┃ ➤ ${prefix}ban @tag
┃ ➤ ${prefix}unban @tag
┃ ➤ ${prefix}listban
┃ ➤ ${prefix}public
┃ ➤ ${prefix}self 
┃ ➤ ${prefix}autotyping on/off
┃ ➤ ${prefix}randomreact on/off
┃ ➤ ${prefix}restart
┗━━━━━━━━━━━━━━━━

*Powered by ©${global.namabot}*
`
        await denn.sendMessage(m.chat, { 
            image: { url: global.fotomenu }, 
            caption: menu,
            contextInfo: {
                externalAdReply: {
                    title: global.namabot,
                    body: `Uptime: ${uptime} | Fitur: ${totalFitur}+`,
                    thumbnailUrl: global.thumbnail,
                    sourceUrl: global.linkMenu,  
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m })
        break
      }

      case 'ping': {
        const t1 = Date.now()
        await m.reply('Pong!')
        await m.reply(`⚡ *${Date.now() - t1}ms*\n⏱️ *Uptime:* ${clockString(process.uptime() * 1000)}`)
        break
      }

      case 'owner': {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${global.namaowner}\nTEL;type=CELL;type=VOICE;waid=${global.owner}:+${global.owner}\nEND:VCARD`
        await denn.sendMessage(m.chat, { contacts: { displayName: global.namaowner, contacts: [{ vcard }] } }, { quoted: m })
        break
      }

      // ==========================================
      //                 CONVERT & TOOLS
      // ==========================================
      case 'stiker':
      case 's': {
        if (!/image|video/.test(mime)) return m.reply(`Kirim/reply gambar atau video dengan caption *${prefix + command}*`)
        if (/video/.test(mime) && qmsg.seconds > 10) return m.reply('Durasi video maksimal 10 detik!')
        
        await m.reply(global.msg.wait)
        try {
          const type = mime.split('/')[0]
          const buffer = await getBuffer(qmsg, type)
          const sticker = new Sticker(buffer, {
            pack: global.namabot,
            author: global.namaowner,
            type: StickerTypes.FULL,
            quality: 70
          })
          await denn.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case 'wm':
      case 'stikerwm': {
        if (!text) return m.reply(`Format: *${prefix + command} pack|author*`)
        if (!/image|video/.test(mime)) return m.reply(`Kirim/reply gambar/video dengan caption *${prefix + command} pack|author*`)
        
        await m.reply(global.msg.wait)
        try {
          const [pack, author] = text.split('|').map(v => v?.trim())
          const type = mime.split('/')[0]
          const buffer = await getBuffer(qmsg, type)
          const sticker = new Sticker(buffer, {
            pack: pack || global.namabot,
            author: author || global.namaowner,
            type: StickerTypes.FULL,
            quality: 70
          })
          await denn.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case 'toimg':
      case 'toimage': {
        if (!/webp/.test(mime)) return m.reply(`Reply stiker dengan caption *${prefix + command}*`)
        await m.reply(global.msg.wait)
        try {
          const buffer = await getBuffer(qmsg, 'sticker')
          const image = await sharp(buffer).png().toBuffer()
          await denn.sendMessage(m.chat, { image: image }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal convert: ${e.message}`) }
        break
      }

      case 'tovid':
      case 'tovideo': {
        if (!/webp/.test(mime)) return m.reply(`Reply stiker bergerak dengan caption *${prefix + command}*`)
        await m.reply(global.msg.wait)
        let tmpFile = `./tmp_${Date.now()}.webp`
        let outFile = `./tmp_${Date.now()}.mp4`
        try {
          const buffer = await getBuffer(qmsg, 'sticker')
          fs.writeFileSync(tmpFile, buffer)
          await new Promise((resolve, reject) => {
            ffmpeg(tmpFile)
              .on('end', resolve)
              .on('error', reject)
              .addOutputOptions(['-pix_fmt yuv420p', '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
              .toFormat('mp4')
              .save(outFile)
          })
          await denn.sendMessage(m.chat, { video: fs.readFileSync(outFile), mimetype: 'video/mp4' }, { quoted: m })
        } catch (e) {
          m.reply(`❌ Gagal convert: ${e.message}`)
        } finally {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
          if (fs.existsSync(outFile)) fs.unlinkSync(outFile)
        }
        break
      }

      case 'tourl': {
        if (!/image/.test(mime)) return m.reply(`Kirim/reply gambar dengan caption *${prefix + command}*`)
        await m.reply(global.msg.wait)
        try {
          const buffer = await getBuffer(qmsg, 'image')
          const service = new ImageUploadService('pixhost.to')
          const { directLink } = await service.uploadFromBinary(buffer, `image_${Date.now()}.jpg`)
          await m.reply(`🔗 *Link:*\n${directLink}`)
        } catch (e) { m.reply(`❌ Gagal upload: ${e.message}`) }
        break
      }

      case 'tts': {
        if (!text) return m.reply(`Contoh: ${prefix}tts halo apa kabar`)
        await m.reply(global.msg.wait)
        try {
          const url = googleTTS.getAudioUrl(text, {
            lang: 'id',
            slow: false,
            host: 'https://translate.google.com',
          })
          await denn.sendMessage(m.chat, { audio: { url }, mimetype: 'audio/mp4', ptt: true }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal TTS: ${e.message}`) }
        break
      }

      case 'rvo':
      case 'readviewonce': {
        if (!m.quoted) return m.reply(`Reply pesan view once (sekali lihat) dengan caption *${prefix + command}*`)
        
        let msg = m.quoted.message
        let type = Object.keys(msg)[0]
        
        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
          msg = msg[type].message
          type = Object.keys(msg)[0]
        }
        
        if (!/image|video|audio/.test(type)) return m.reply('❌ Media tidak didukung atau bukan View Once!')
        
        try {
          const buffer = await getBuffer(msg[type], type.replace('Message', '').toLowerCase())
          if (type === 'imageMessage') {
            await denn.sendMessage(m.chat, { image: buffer, caption: msg[type].caption || '' }, { quoted: m })
          } else if (type === 'videoMessage') {
            await denn.sendMessage(m.chat, { video: buffer, caption: msg[type].caption || '' }, { quoted: m })
          } else if (type === 'audioMessage') {
            await denn.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, { quoted: m })
          }
        } catch (e) { m.reply(`❌ Gagal ambil media: ${e.message}`) }
        break
      }

      case 'gitclone': {
        if (!isOwner) return m.reply(global.msg.owner)
        if (!text) return m.reply(`Contoh: ${prefix}gitclone https://github.com/user/repo`)
        await m.reply(global.msg.wait)
        try {
          const repoName = text.split('/').pop().replace('.git', '')
          const folder = `./tmp_${repoName}_${Date.now()}`
          
          await new Promise((resolve, reject) => {
            exec(`git clone ${text} ${folder}`, (err) => err ? reject(err) : resolve())
          })
          
          const zip = new AdmZip()
          zip.addLocalFolder(folder)
          const zipBuffer = zip.toBuffer()
          
          fs.rmSync(folder, { recursive: true, force: true })
          
          await denn.sendMessage(m.chat, { 
            document: zipBuffer, 
            mimetype: 'application/zip', 
            fileName: `${repoName}.zip`,
            caption: `✅ Berhasil clone repository *${repoName}*`
          }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal clone: ${e.message}`) }
        break
      }

      // ==========================================
      //                 GROUP MENU
      // ==========================================
      case 'kick': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        
        const target = getTarget()
        if (!target) return m.reply(`Tag/reply target atau masukkan nomor`)
        try {
          await denn.groupParticipantsUpdate(m.chat, [target], 'remove')
          m.reply(`✅ Berhasil mengeluarkan @${target.split('@')[0]}`, { mentions: [target] })
        } catch (e) { m.reply(`❌ Gagal kick: ${e.message}`) }
        break
      }

      case 'add': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        if (!text) return m.reply(`Contoh: ${prefix + command} 628xxx`)
        
        const target = text.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        try {
          await denn.groupParticipantsUpdate(m.chat, [target], 'add')
          m.reply(`✅ Berhasil menambahkan @${target.split('@')[0]}`, { mentions: [target] })
        } catch (e) { m.reply(`❌ Gagal add: ${e.message}`) }
        break
      }

      case 'promote': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        const target = getTarget()
        if (!target) return m.reply(`Tag/reply target atau masukkan nomor`)
        try {
          await denn.groupParticipantsUpdate(m.chat, [target], 'promote')
          m.reply(`✅ Berhasil promote @${target.split('@')[0]} menjadi admin.`, { mentions: [target] })
        } catch (e) { m.reply(`❌ Gagal promote: ${e.message}`) }
        break
      }

      case 'demote': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        const target = getTarget()
        if (!target) return m.reply(`Tag/reply target atau masukkan nomor`)
        try {
          await denn.groupParticipantsUpdate(m.chat, [target], 'demote')
          m.reply(`✅ Berhasil demote @${target.split('@')[0]}.`, { mentions: [target] })
        } catch (e) { m.reply(`❌ Gagal demote: ${e.message}`) }
        break
      }

      case 'tagall':
      case 'hidetag': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        
        const metadata = await denn.groupMetadata(m.chat)
        const participants = metadata.participants.map(p => p.id)
        let txt = text ? text : 'Pengumuman!'
        if (command === 'tagall') {
           txt += '\n\n'
           participants.forEach(p => { txt += `@${p.split('@')[0]}\n` })
        }
        await denn.sendMessage(m.chat, { text: txt.trim(), mentions: participants }, { quoted: m })
        break
      }

      case 'linkgc': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        try {
          const code = await denn.groupInviteCode(m.chat)
          m.reply(`🔗 *Link Group:*\nhttps://chat.whatsapp.com/${code}`)
        } catch (e) { m.reply(`❌ Gagal ambil link: ${e.message}`) }
        break
      }

      case 'setname': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        if (!text) return m.reply(`Contoh: ${prefix + command} Nama Baru`)
        try {
          await denn.groupUpdateSubject(m.chat, text)
          m.reply(`✅ Nama grup diubah menjadi: *${text}*`)
        } catch (e) { m.reply(`❌ Gagal ganti nama: ${e.message}`) }
        break
      }

      case 'setdesc': {
        if (!m.isGroup) return m.reply(global.msg.group)
        const { isAdmin, isBotAdmin } = await checkAdmin()
        if (!isAdmin && !isOwner) return m.reply(global.msg.admin)
        if (!isBotAdmin) return m.reply(global.msg.botadmin)
        if (!text) return m.reply(`Contoh: ${prefix + command} Deskripsi Baru`)
        try {
          await denn.groupUpdateDescription(m.chat, text)
          m.reply(`✅ Deskripsi grup berhasil diubah.`)
        } catch (e) { m.reply(`❌ Gagal ganti deskripsi: ${e.message}`) }
        break
      }

      // ==========================================
      //                 OWNER MENU
      // ==========================================
      case 'autotyping': {
        if (!isOwner) return m.reply(global.msg.owner)
        if (!text) return m.reply(`Format: ${prefix + command} on/off`)
        global.autotyping = text.toLowerCase() === 'on'
        m.reply(`✅ Auto-Typing berhasil di *${global.autotyping ? 'ON' : 'OFF'}* kan.`)
        break
      }

      case 'randomreact': {
        if (!isOwner) return m.reply(global.msg.owner)
        if (!text) return m.reply(`Format: ${prefix + command} on/off`)
        global.randomreact = text.toLowerCase() === 'on'
        m.reply(`✅ Random-React berhasil di *${global.randomreact ? 'ON' : 'OFF'}* kan.`)
        break
      }

      case 'ban': {
        if (!isOwner) return m.reply(global.msg.owner)
        const target = getTarget()
        if (!target) return m.reply(`Tag/reply target atau masukkan nomor`)
        if (global.db.banned.includes(target)) return m.reply('User sudah di-ban!')
        global.db.banned.push(target)
        m.reply(`🚫 Berhasil mem-ban @${target.split('@')[0]}`, { mentions: [target] })
        break
      }

      case 'unban': {
        if (!isOwner) return m.reply(global.msg.owner)
        const target = getTarget()
        if (!target) return m.reply(`Tag/reply target atau masukkan nomor`)
        if (!global.db.banned.includes(target)) return m.reply('User tidak ada di list ban!')
        global.db.banned = global.db.banned.filter(v => v !== target)
        m.reply(`✅ Berhasil unban @${target.split('@')[0]}`, { mentions: [target] })
        break
      }

      case 'listban': {
        if (!isOwner) return m.reply(global.msg.owner)
        if (global.db.banned.length === 0) return m.reply('List ban kosong.')
        let txt = `📋 *LIST BAN (${global.db.banned.length})*\n\n`
        global.db.banned.forEach((v, i) => { txt += `${i + 1}. @${v.split('@')[0]}\n` })
        m.reply(txt.trim(), { mentions: global.db.banned })
        break
      }

      case 'self': {
        if (!isOwner) return m.reply(global.msg.owner)
        global.db.public = false
        m.reply('✅ Bot diubah ke mode *SELF* (Hanya Owner)')
        break
      }

      case 'public': {
        if (!isOwner) return m.reply(global.msg.owner)
        global.db.public = true
        m.reply('✅ Bot diubah ke mode *PUBLIC* (Semua Orang)')
        break
      }

      case 'restart': {
        if (!isOwner) return m.reply(global.msg.owner)
        await m.reply('🔄 Merestart bot...')
        process.exit(0)
        break
      }

      case 'pushkontak':
      case 'jpm': {
        if (!isOwner) return m.reply(global.msg.owner)
        if (!m.isGroup) return m.reply(global.msg.group)
        if (!text) return m.reply(`Format: *${prefix + command} <teks pesan>*`)
        await m.reply(`⏳ Memulai push kontak...`)
        try {
          const metadata = await denn.groupMetadata(m.chat)
          const members = metadata.participants.map(v => v.id)
          let count = 0
          for (let jid of members) {
            if (jid === botNumber) continue
            await denn.sendMessage(jid, { text: text })
            count++
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 4000)) 
          }
          m.reply(`✅ Berhasil mengirim pesan ke ${count} member.`)
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case '>': {
        if (!isOwner) return m.reply(global.msg.owner)
        try {
          let evaled = await eval(text)
          if (typeof evaled !== 'string') evaled = util.inspect(evaled)
          m.reply(util.format(evaled))
        } catch (e) { m.reply(util.format(e)) }
        break
      }

      case '$': {
        if (!isOwner) return m.reply(global.msg.owner)
        exec(text, (err, stdout) => {
          if (err) return m.reply(err.toString())
          if (stdout) return m.reply(util.format(stdout))
        })
        break
      }

      // ==========================================
      //                 DOWNLOADER
      // ==========================================
      case 'play': {
        if (!text) return m.reply(`Contoh: ${prefix}play lofi hip hop`)
        await m.reply(global.msg.wait)
        try {
          const search = await yts(text)
          if (!search.videos.length) return m.reply('Lagu tidak ditemukan.')
          const video = search.videos[0]
          const apiUrl = `${global.baseTermai}/downloader/youtube?url=${encodeURIComponent(video.url)}&format=mp3&key=${global.apiTermai}`
          const res = await axios.get(apiUrl)
          if (!res.data.status || !res.data.data) throw new Error('Gagal mengambil audio')
          const audioUrl = res.data.data.url || res.data.data.download_url
          await denn.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg' }, { quoted: m })
          await m.reply(`🎵 *${video.title}*`)
        } catch (e) { m.reply(`❌ Error: ${e.message}`) }
        break
      }

      case 'ytmp3': {
        if (!text) return m.reply(`Contoh: ${prefix}ytmp3 https://youtu.be/xxx`)
        await m.reply(global.msg.wait)
        try {
          const apiUrl = `${global.baseTermai}/downloader/youtube?url=${encodeURIComponent(text)}&format=mp3&key=${global.apiTermai}`
          const res = await axios.get(apiUrl)
          if (!res.data.status || !res.data.data) throw new Error('Gagal mengunduh audio')
          const audioUrl = res.data.data.url || res.data.data.download_url
          await denn.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg' }, { quoted: m })
          await m.reply(`✅ Berhasil diunduh.`)
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case 'ytmp4': {
        if (!text) return m.reply(`Contoh: ${prefix}ytmp4 https://youtu.be/xxx`)
        await m.reply(global.msg.wait)
        try {
          const apiUrl = `${global.baseTermai}/downloader/youtube?url=${encodeURIComponent(text)}&format=mp4&key=${global.apiTermai}`
          const res = await axios.get(apiUrl)
          if (!res.data.status || !res.data.data) throw new Error('Gagal mengunduh video')
          const videoUrl = res.data.data.url || res.data.data.download_url
          await denn.sendMessage(m.chat, { video: { url: videoUrl }, mimetype: 'video/mp4' }, { quoted: m })
          await m.reply(`✅ Berhasil diunduh.`)
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case 'tiktok':
      case 'tt': {
        if (!text) return m.reply(`Contoh: ${prefix}tiktok https://vt.tiktok.com/xxx`)
        await m.reply(global.msg.wait)
        try {
          const apiUrl = `${global.baseTermai}/downloader/tiktok?url=${encodeURIComponent(text)}&key=${global.apiTermai}`
          const res = await axios.get(apiUrl)
          if (!res.data.status || !res.data.data) throw new Error('Gagal mengambil video')
          const videoUrl = res.data.data.video || res.data.data.download_url || res.data.data.url
          await denn.sendMessage(m.chat, { video: { url: videoUrl }, caption: `🎵 *TikTok Downloader*` }, { quoted: m })
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      case 'ig':
      case 'instagram': {
        if (!text) return m.reply(`Contoh: ${prefix}ig https://www.instagram.com/p/xxx`)
        await m.reply(global.msg.wait)
        try {
          const apiUrl = `${global.baseTermai}/downloader/instagram?url=${encodeURIComponent(text)}&key=${global.apiTermai}`
          const res = await axios.get(apiUrl)
          if (!res.data.status || !res.data.data) throw new Error('Gagal mengambil media')
          const mediaUrl = res.data.data.url || res.data.data.download_url || (res.data.data[0] && res.data.data[0].url)
          const isVideo = mediaUrl.includes('.mp4')
          if (isVideo) {
            await denn.sendMessage(m.chat, { video: { url: mediaUrl }, caption: `📸 *Instagram Downloader*` }, { quoted: m })
          } else {
            await denn.sendMessage(m.chat, { image: { url: mediaUrl }, caption: `📸 *Instagram Downloader*` }, { quoted: m })
          }
        } catch (e) { m.reply(`❌ Gagal: ${e.message}`) }
        break
      }

      default:
        break
    }
  } catch (e) {
    console.log(e)
    denn.sendMessage(`${global.owner}@s.whatsapp.net`, { text: `${util.format(e)}` }, { quoted: m })
  }
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.cyan("File Update => "), chalk.cyan.bgBlue.bold(`${__filename}`))
  delete require.cache[file]
  require(file)
})