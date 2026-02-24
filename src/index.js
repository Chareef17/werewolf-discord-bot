require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const Game = require('./game/Game');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const games = new Map();

client.once(Events.ClientReady, (c) => {
  console.log(`🐺 บอทพร้อมใช้งาน! เข้าสู่ระบบเป็น ${c.user.tag}`);
});

// ─── Slash Command ──────────────────────────────────────

async function handleSlashCommand(interaction) {
  if (interaction.commandName !== 'werewolf') return;

  const channelId = interaction.channelId;
  const action = interaction.options?.getString('action');

  // /werewolf end — เจ้าของห้องจบเกม
  if (action === 'end') {
    const game = games.get(channelId);
    if (!game || game.phase === 'ended') {
      return interaction.reply({
        content: '❌ ไม่มีเกมกำลังดำเนินอยู่ในช่องนี้',
        ephemeral: true,
      });
    }
    if (interaction.user.id !== game.host.id) {
      return interaction.reply({
        content: '❌ เฉพาะเจ้าของห้องเท่านั้นที่สามารถจบเกมได้',
        ephemeral: true,
      });
    }
    await interaction.reply({ content: '🛑 กำลังจบเกม...', ephemeral: true });
    await game.forceEndByHost();
    return;
  }

  // /werewolf หรือ /werewolf start — สร้างห้องเกม
  if (games.has(channelId)) {
    const existing = games.get(channelId);
    if (existing.phase !== 'ended') {
      return interaction.reply({
        content: '❌ มีเกมกำลังดำเนินอยู่ในช่องนี้แล้ว (ใช้ /werewolf end เพื่อจบเกม)',
        ephemeral: true,
      });
    }
    games.delete(channelId);
  }

  const game = new Game(interaction.channel, interaction.user, client);
  games.set(channelId, game);

  await interaction.reply({
    embeds: [game.createLobbyEmbed()],
    components: [game.createLobbyComponents()],
  });

  game.lobbyMessage = await interaction.fetchReply();
}

// ─── Button Interactions ────────────────────────────────

async function handleButton(interaction) {
  const [prefix, action, channelId] = interaction.customId.split(':');
  if (prefix !== 'ww') return;

  const game = games.get(channelId);
  if (!game || game.phase === 'ended') {
    return interaction.reply({ content: '❌ ไม่พบเกม หรือเกมจบไปแล้ว', ephemeral: true });
  }

  switch (action) {
    case 'join': {
      const result = game.addPlayer(interaction.user);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.msg}`, ephemeral: true });
      }
      await interaction.update({
        embeds: [game.createLobbyEmbed()],
        components: [game.createLobbyComponents()],
      });
      break;
    }

    case 'leave': {
      const result = game.removePlayer(interaction.user.id);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.msg}`, ephemeral: true });
      }
      await interaction.update({
        embeds: [game.createLobbyEmbed()],
        components: [game.createLobbyComponents()],
      });
      break;
    }

    case 'start': {
      if (interaction.user.id !== game.host.id) {
        return interaction.reply({
          content: '❌ เฉพาะเจ้าของห้องเท่านั้นที่สามารถเริ่มเกมได้',
          ephemeral: true,
        });
      }

      if (game.players.size < 4) {
        return interaction.reply({
          content: `❌ ต้องมีผู้เล่นอย่างน้อย 4 คน (ตอนนี้มี ${game.players.size} คน)`,
          ephemeral: true,
        });
      }

      await interaction.update({
        embeds: [
          game
            .createLobbyEmbed()
            .setTitle('🐺 เกมหมาป่า — กำลังเริ่ม...')
            .setFooter({ text: 'กำลังแจกบทบาท...' }),
        ],
        components: [],
      });

      const result = await game.startGame();
      if (!result.success) {
        await interaction.followUp({ content: `❌ ${result.msg}`, ephemeral: true });
      }
      break;
    }

    case 'cancel': {
      if (interaction.user.id !== game.host.id) {
        return interaction.reply({
          content: '❌ เฉพาะเจ้าของห้องเท่านั้นที่สามารถจบเกมได้',
          ephemeral: true,
        });
      }
      if (game.phase === 'lobby') {
        games.delete(channelId);
        return interaction.update({
          embeds: [
            { title: '🐺 เกมหมาป่า', description: '🛑 เกมถูกยกเลิกโดยเจ้าของห้อง', color: 0x95a5a6 },
          ],
          components: [],
        });
      }
      await interaction.deferUpdate();
      await game.forceEndByHost();
      break;
    }
  }
}

// ─── Select Menu Interactions ───────────────────────────

async function handleSelectMenu(interaction) {
  const [prefix, action, channelId] = interaction.customId.split(':');
  if (prefix !== 'ww') return;

  const game = games.get(channelId);
  if (!game || game.phase === 'ended') {
    return interaction.reply({ content: '❌ ไม่พบเกม หรือเกมจบไปแล้ว', ephemeral: true });
  }

  const selectedValue = interaction.values[0];

  switch (action) {
    case 'kill':
    case 'check':
    case 'protect': {
      const result = game.handleNightAction(interaction.user.id, action, selectedValue);
      await interaction.update({
        content: result.success ? `✅ ${result.msg}` : `❌ ${result.msg}`,
        components: [],
        embeds: [],
      });
      break;
    }

    case 'vote': {
      const result = game.handleDayVote(interaction.user.id, selectedValue);
      await interaction.reply({
        content: result.success ? `✅ ${result.msg}` : `❌ ${result.msg}`,
        ephemeral: true,
      });
      break;
    }

    case 'shoot': {
      const result = await game.handleHunterShoot(interaction.user.id, selectedValue);
      await interaction.update({
        content: result.success ? `✅ ${result.msg}` : `❌ ${result.msg}`,
        components: [],
        embeds: [],
      });
      break;
    }
  }
}

// ─── Game Cleanup ───────────────────────────────────────

function cleanupEndedGames() {
  for (const [channelId, game] of games) {
    if (game.phase === 'ended') {
      games.delete(channelId);
    }
  }
}

setInterval(cleanupEndedGames, 5 * 60 * 1000);

// ─── Event Handlers ─────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    try {
      const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch {
      // Interaction already expired
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
