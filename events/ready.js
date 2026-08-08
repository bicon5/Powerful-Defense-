const { Events } = require('discord.js');
const { ensureLogChannels } = require('../modules/logging/ensureLogChannels');
const { registerGuildChannels } = require('../modules/logging/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[READY] Бот запущен как ${client.user.tag}`);

    // Для каждого сервера, где уже есть бот, гарантируем наличие лог-каналов
    // и кэшируем их ID для быстрого доступа в logger.js
    for (const guild of client.guilds.cache.values()) {
      try {
        const channels = await ensureLogChannels(guild);
        registerGuildChannels(guild.id, channels);
        console.log(`[READY] Лог-каналы готовы на сервере "${guild.name}"`);
      } catch (err) {
        console.error(`[READY] Не удалось создать лог-каналы на "${guild.name}":`, err.message);
      }
    }
  },
};
