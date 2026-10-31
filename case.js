const fs = require('fs')
const util = require('util')
const chalk = require('chalk')
const yts = require('yt-search')
const { ytmp3, ytmp4 } = require('ruhend-scraper')
const clockString = (ms) => {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

module.exports = async (denn, m) => {
  try {
    const body = m.mtype === 'conversation' ? m.message.conversation
      : m.mtype === 'imageMessage' ? m.message.imageMessage.caption
      : m.mtype === 'videoMessage' ? m.message.videoMessage.caption
      : m.mtype === 'extendedTextMessage' ? m.message.extendedTextMessage.text
      : ''

    if (!body) return
    const prefixMatch = body.match(/^[^a-zA-Z0-9\s]/)
    if (!prefixMatch) return   
    const prefix = prefixMatch[0]
    const args = body.slice(prefix.length).trim().split(/ +/)
    const command = args.shift()?.toLowerCase()
    if (!command) return
    const text = args.join(' ')
    const botNumber = await denn.decodeJid(denn.user.id)
    const isOwner = m.sender.split('@')[0] === global.owner || m.key.fromMe

    console.log(chalk.white.bgCyan.bold(global.namabot), chalk.blue.bold(`[ PESAN ]`), chalk.blue.bold(`DARI`), chalk.blue.bold(`${m.sender.split("@")[0]}`), chalk.blue.bold(`Text :`), chalk.blue.bold(`${prefix + command}`))

    switch (command) {
            case 'menu':
      case 'help': {
        const uptime = clockString(process.uptime() * 1000)
        const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const jam = new Date().toLocaleTimeString('id-ID')
        
        const menu = `
╭───〔 *${global.namabot}* 〕───
│ *⏰ Jam:* ${jam}
│ *📅 Tgl:* ${tanggal}
│ *⚡ Uptime:* ${uptime}
│ *👤 User:* ${m.pushName || 'User'}
╰─────────────────

┏━━━〔 *MAIN MENU* 〕━━━┓
┃ ➤ ${prefix}menu
┃ ➤ ${prefix}ping
┃ ➤ ${prefix}owner
┃ ➤ ${prefix}script
┗━━━━━━━━━━━━━━━━

┏━━━〔 *DOWNLOADER* 〕━━━┓
┃ ➤ ${prefix}play <judul>
┃ ➤ ${prefix}ytmp3 <url>
┃ ➤ ${prefix}ytmp4 <url>
┃ ➤ ${prefix}tiktok <url>
┃ ➤ ${prefix}ig <url>
┗━━━━━━━━━━━━━━━━

*Powered by ©${global.namabot}*
`
        await denn.sendMessage(m.chat, { 
            image: { url: global.fotomenu }, 
            caption: menu,
            contextInfo: {
                externalAdReply: {
                    title: global.namabot,
                    body: `Uptime: ${uptime}`,
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
        await m.reply(`⚡ *${Date.now() - t1}ms*`)
        break
      }

      case 'owner': {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${global.namaowner}\nTEL;type=CELL;type=VOICE;waid=${global.owner}:+${global.owner}\nEND:VCARD`
        await denn.sendMessage(m.chat, { contacts: { displayName: global.namaowner, contacts: [{ vcard }] } }, { quoted: m })
        break
      }

      case 'play': {
        if (!text) return m.reply(`Contoh: ${prefix}play lofi hip hop`)
        await m.reply(global.msg.wait)
        const search = await yts(text)
        if (!search.videos.length) return m.reply('Lagu tidak ditemukan.')
        
        const video = search.videos[0]
        const res = await ytmp3(video.url)
        
        await denn.sendMessage(m.chat, { 
          audio: { url: res.audio }, 
          mimetype: 'audio/mpeg' 
        }, { quoted: m })
        await m.reply(`🎵 *${video.title}*`)
        break
      }

      case 'ytmp3': {
        if (!text) return m.reply(`Contoh: ${prefix}ytmp3 https://youtu.be/xxx`)
        await m.reply(global.msg.wait)
        const res = await ytmp3(text)
        await denn.sendMessage(m.chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
        await m.reply(`✅ Berhasil diunduh.`)
        break
      }

      case 'ytmp4': {
        if (!text) return m.reply(`Contoh: ${prefix}ytmp4 https://youtu.be/xxx`)
        await m.reply(global.msg.wait)
        const res = await ytmp4(text)
        await denn.sendMessage(m.chat, { video: { url: res.video }, mimetype: 'video/mp4' }, { quoted: m })
        await m.reply(`✅ Berhasil diunduh.`)
        break
      }

      case '>': {
        if (!isOwner) return m.reply(global.msg.owner)
        try {
          let evaled = await eval(text)
          if (typeof evaled !== 'string') evaled = util.inspect(evaled)
          m.reply(util.format(evaled))
        } catch (e) {
          m.reply(util.format(e))
        }
        break
      }

      case '$': {
        if (!isOwner) return m.reply(global.msg.owner)
        const { exec } = require('child_process')
        exec(text, (err, stdout) => {
          if (err) return m.reply(err.toString())
          if (stdout) return m.reply(util.format(stdout))
        })
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