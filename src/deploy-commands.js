require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('werewolf')
    .setDescription('สร้างห้องเกมหมาป่า (Werewolf)')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('กำลังลงทะเบียนคำสั่ง Slash...');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log('ลงทะเบียนคำสั่งสำเร็จ!');
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
  }
})();
