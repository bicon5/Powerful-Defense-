const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

/**
 * Проверяет, есть ли на сервере нужные лог-каналы, и создаёт недостающие.
 * Вызывается при старте бота для каждого сервера (см. events/ready.js)
 * и при вступлении на новый сервер (events/guildCreate.js).
 *
 * Права на каналы выставляются так, чтобы обычные юзеры их не видели —
 * только роли с правом ViewAuditLog / ManageGuild и сам бот.
 */
async function ensureLogChannels(guild) {
  const created = {};

  const existingCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === 'Guardian Logs'
  );
  const category = existingCategory || await guild.channels.create({
    name: 'Guardian Logs',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ],
  });

  const channelsToEnsure = [
    { key: 'modLog', name: config.autoChannels.modLog, topic: 'Действия автомода: варны, муты, кики, баны' },
    { key: 'securityLog', name: config.autoChannels.securityLog, topic: 'Аудит безопасности: изменения конфига, права, подозрительные действия' },
    { key: 'evidenceLog', name: config.autoChannels.evidenceLog, topic: 'Доказательства нарушений: снимки сообщений, вложения' },
  ];

  for (const ch of channelsToEnsure) {
    let channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === ch.name && c.parentId === category.id
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: ch.topic,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: guild.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
            ],
          },
        ],
      });
      console.log(`[LOGGING] Создан канал #${ch.name} на сервере "${guild.name}"`);
    }

    created[ch.key] = channel.id;
  }

  return created;
}

module.exports = { ensureLogChannels };
