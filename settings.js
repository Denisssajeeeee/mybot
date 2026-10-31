const chalk = require('chalk')
const fs = require('fs')

global.owner = "628xxx"
global.namabot = "Bot Base"
global.namaowner = "Denn"



global.fotomenu = "https://img1.pixhost.to/images/6657/613966780_levvihosting.jpg" // Foto Menu
global.linkMenu = "https://c.termai.cc/i111/TUqdGPz.jpg" // Link Menu 
global.thumbnail = "https://c.termai.cc/i111/TUqdGPz.jpg" // Thumbail



global.msg = {
  wait: "Memproses...",
  owner: "LU BUKAN OWNER !",
  group: "Fitur ini untuk dalam grup!",
  admin: "LU BUKAN ADMIN!",
  botadmin: "Fitur ini harus bot jadi admin"
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.cyan("File Update => "), chalk.cyan.bgBlue.bold(`${__filename}`))
  delete require.cache[file]
  require(file)
})