require('dotenv').config();
const { Client, REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('werewolf')
    .setDescription('เกมหมาป่า (Werewolf)')
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('สร้างห้อง (ว่าง) หรือ จบเกม')
        .setRequired(false)
        .addChoices({ name: 'จบเกม', value: 'end' })
    )
    .toJSON(),
];

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ใส่ DISCORD_TOKEN ในไฟล์ .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function getApplicationId() {
  if (process.env.CLIENT_ID) return process.env.CLIENT_ID;
  const client = new Client({ intents: [] });
  return new Promise((resolve, reject) => {
    client.once('ready', () => {
      const id = client.application.id;
      client.destroy();
      resolve(id);
    });
    client.once('error', reject);
    client.login(token);
  });
}

(async () => {
  try {
    const clientId = await getApplicationId();
    const guildId = process.env.GUILD_ID;

    if (guildId) {
      console.log('กำลังลงทะเบียนคำสั่ง Slash (เซิร์ฟเวอร์เดียว)...');
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
    } else {
      console.log('กำลังลงทะเบียนคำสั่ง Slash...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
    }
    console.log('✅ ลงทะเบียนสำเร็จ! ใช้ /werewolf ใน Discord ได้เลย');
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    if (error.code === 50001) {
      console.error('   → บอทไม่มีสิทธิ์ในเซิร์ฟเวอร์ หรือเชิญบอทใหม่โดยเลือก applications.commands');
    }
    process.exit(1);
  }
})();
