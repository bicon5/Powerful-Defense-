const { Events } = require('discord.js');
const { ensureLogChannels } = require('../modules/logging/ensureLogChannels');
const { registerGuildChannels } = require('../modules/logging/logger');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    console.log(`[GUILD] Бота добавили на новый сервер: "${guild.name}" (${guild.id})`);
    try {
      const channels = await ensureLogChannels(guild);
      registerGuildChannels(guild.id, channels);
    } catch (err) {
      console.error(`[GUILD] Не удалось создать лог-каналы на "${guild.name}":`, err.message);
    }
  },
};
