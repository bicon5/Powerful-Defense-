const { EmbedBuilder } = require('discord.js');

// Кэш ID лог-каналов на сервер, чтобы не искать их каждый раз в guild.channels.cache.
// Заполняется из ensureLogChannels при старте (см. events/ready.js).
const logChannelCache = new Map(); // guildId -> { modLog, securityLog, evidenceLog }

function registerGuildChannels(guildId, channels) {
  logChannelCache.set(guildId, channels);
}

function getChannelIds(guildId) {
  return logChannelCache.get(guildId) || {};
}

const ACTION_COLORS = {
  warned: 0xf1c40f,   // жёлтый
  muted: 0xe67e22,    // оранжевый
  kicked: 0xe74c3c,   // красный
  banned: 0x992d22,   // тёмно-красный
  deleted: 0x95a5a6,  // серый
  raid_detected: 0x9b59b6, // фиолетовый
};

/**
 * Отправляет запись о модерационном действии в mod-log, включая доказательство
 * (текст сообщения, вложения) прямо в embed, чтобы модераторы и сам юзер при
 * апелляции могли увидеть, за что именно было применено действие.
 */
async function logModAction(guild, {
  action,          // 'warned' | 'muted' | 'kicked' | 'banned' | 'deleted'
  targetUser,      // объект User нарушителя
  reason,
  moderator,       // 'AutoMod' или объект User модератора
  evidence,        // { content, attachments, channelId, messageId } | null
  score,           // текущий счёт нарушений юзера, опционально
}) {
  const channels = getChannelIds(guild.id);
  const channel = channels.modLog ? await guild.channels.fetch(channels.modLog).catch(() => null) : null;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(ACTION_COLORS[action] || 0x2f3136)
    .setTitle(`Действие: ${actionLabel(action)}`)
    .setDescription(`**Пользователь:** ${targetUser.tag} (${targetUser.id})`)
    .addFields(
      { name: 'Причина', value: reason || 'Не указана', inline: true },
      { name: 'Модератор', value: typeof moderator === 'string' ? moderator : `${moderator.tag}`, inline: true }
    )
    .setTimestamp();

  if (score !== undefined) {
    embed.addFields({ name: 'Текущий счёт нарушений', value: String(score), inline: true });
  }

  if (evidence?.content) {
    // Обрезаем на случай очень длинных сообщений — embed field limit 1024 символа
    const snippet = evidence.content.length > 1000
      ? evidence.content.slice(0, 1000) + '…'
      : evidence.content;
    embed.addFields({ name: 'Доказательство (текст сообщения)', value: `\`\`\`${snippet}\`\`\`` });
  }

  if (evidence?.channelId) {
    embed.addFields({ name: 'Канал нарушения', value: `<#${evidence.channelId}>`, inline: true });
  }

  if (evidence?.attachments?.length) {
    embed.addFields({ name: 'Вложения', value: evidence.attachments.join('\n') });
    // Discord сам отрендерит превью первой картинки, если поставить её как image
    if (evidence.attachments[0].match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      embed.setImage(evidence.attachments[0]);
    }
  }

  embed.setFooter({ text: targetUser.id });

  await channel.send({ embeds: [embed] }).catch((err) => {
    console.error('[LOGGER] Не удалось отправить лог в mod-log:', err.message);
  });
}

/**
 * Логирует события безопасности самого бота (изменение конфига, выдача ролей,
 * подозрительные попытки использовать команды без прав).
 */
async function logSecurityEvent(guild, { action, actor, details }) {
  const channels = getChannelIds(guild.id);
  const channel = channels.securityLog ? await guild.channels.fetch(channels.securityLog).catch(() => null) : null;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`Security: ${action}`)
    .setDescription(details || '—')
    .addFields({ name: 'Инициатор', value: typeof actor === 'string' ? actor : `${actor.tag} (${actor.id})` })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch((err) => {
    console.error('[LOGGER] Не удалось отправить security-лог:', err.message);
  });
}

/**
 * Логирует детект рейда отдельным ярким сообщением + пинг владельца, если задан.
 */
async function logRaidDetected(guild, { joinCount, windowMs, ownerId }) {
  const channels = getChannelIds(guild.id);
  const channel = channels.securityLog ? await guild.channels.fetch(channels.securityLog).catch(() => null) : null;

  const embed = new EmbedBuilder()
    .setColor(ACTION_COLORS.raid_detected)
    .setTitle('🚨 Обнаружен подозрительный наплыв участников (возможный рейд)')
    .setDescription(`${joinCount} новых участников за ${Math.round(windowMs / 1000)} секунд.`)
    .addFields({ name: 'Действие', value: 'Включён режим lockdown (см. конфиг antiraid).' })
    .setTimestamp();

  if (channel) {
    await channel.send({
      content: ownerId ? `<@${ownerId}>` : undefined,
      embeds: [embed],
    }).catch(() => {});
  }
}

function actionLabel(action) {
  const labels = {
    warned: 'Предупреждение',
    muted: 'Мут',
    kicked: 'Кик',
    banned: 'Бан',
    deleted: 'Удаление сообщения',
  };
  return labels[action] || action;
}

module.exports = {
  registerGuildChannels,
  getChannelIds,
  logModAction,
  logSecurityEvent,
  logRaidDetected,
};
