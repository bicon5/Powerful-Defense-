const { Events, PermissionFlagsBits } = require('discord.js');
const { checkSpam } = require('../modules/automod/spamFilter');
const { checkBadWords } = require('../modules/automod/wordFilter');
const { checkLinks } = require('../modules/automod/linkFilter');
const { handleViolation } = require('../modules/automod/punishmentEngine');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Игнорируем ботов (включая себя) и ЛС — автомод работает только на серверах
    if (message.author.bot || !message.guild) return;

    // Модераторы (право ManageMessages) не проверяются автомодом —
    // иначе они сами будут банить себя же при тестировании команд
    const member = message.member;
    if (!member) return;
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    try {
      // Порядок проверок: от самого дешёвого по вычислениям к самому дорогому.
      // Как только нашли нарушение — прекращаем (не наказываем за несколько вещей разом
      // за одно сообщение, это было бы избыточно жёстко).

      const spamResult = checkSpam(message);
      if (spamResult.isSpam) {
        await punish(message, 'spam', spamResult.reason);
        return;
      }

      const linkResult = checkLinks(message, message.guild.id);
      if (linkResult.blocked) {
        await punish(message, linkResult.type, linkResult.reason);
        return;
      }

      const wordResult = checkBadWords(message);
      if (wordResult.hasBadWord) {
        await punish(message, 'badWord', wordResult.reason);
        return;
      }
    } catch (err) {
      // Один сбой в автомоде не должен ронять весь процесс обработки сообщений
      console.error('[AUTOMOD] Ошибка при обработке сообщения:', err);
    }
  },
};

async function punish(message, type, reason) {
  // Сначала удаляем нарушающее сообщение (если бот всё ещё видит его —
  // между детектом и удалением юзер мог сам стереть сообщение)
  await message.delete().catch(() => {});

  await handleViolation({
    guild: message.guild,
    member: message.member,
    type,
    reasonText: reason,
    message,
  });
}
