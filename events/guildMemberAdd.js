const { Events } = require('discord.js');
const { trackJoin } = require('../modules/antiraid/joinTracker');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      await trackJoin(member);
    } catch (err) {
      console.error('[ANTIRAID] Ошибка при обработке вступления:', err);
    }
  },
};
