const chalk = require('chalk')
const fs = require('fs')

global.owner = "628xxx" // Nomor Owner
global.namabot = "Bot Whatsapp" // Nama Bot
global.namaowner = "Owner" // Nama Owner

// Settings Image
global.fotomenu = "https://img3.pixhost.to/images/6852/796591158_image_1793525063789.jpg"
global.linkMenu = "https://img3.pixhost.to/images/6852/796591540_image_1793525121921.jpg"
global.thumbnail = "https://c.termai.cc/i111/TUqGPz.jpg"

// Settings Apikey
global.baseTermai = "https://api.termai.cc/api"
global.apiTermai = "-"

// Settings statistik
global.autotyping = false
global.randomreact = false


// Settings Message
global.msg = {
  wait: "⏳ Memproses...",
  owner: "❌ LU BUKAN OWNER !",
  group: "❌ Fitur ini untuk dalam grup!",
  admin: "❌ LU BUKAN ADMIN!",
  botadmin: "❌ Fitur ini harus bot jadi admin"
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.cyan("File Update => "), chalk.cyan.bgBlue.bold(`${__filename}`))
  delete require.cache[file]
  require(file)
})