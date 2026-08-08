const config = require('../../config');
const { addInfraction, getActiveScore, saveEvidence } = require('../../database/records');
const { logModAction } = require('../logging/logger');

/**
 * Центральная точка принятия решений автомода. Вызывается всеми фильтрами
 * (spamFilter, wordFilter, linkFilter и т.д.) с типом нарушения.
 * Считает накопленный балл (с decay — старые баллы не учитываются) и решает,
 * какое действие применить: ничего / warn / mute / kick / ban.
 *
 * Всегда сохраняет доказательство до применения действия, чтобы у любого
 * автоматического наказания была прослеживаемая причина.
 */
async function handleViolation({ guild, member, type, reasonText, message }) {
  const weight = config.automod.weights[type] || 1;

  const evidenceId = saveEvidence({
    guildId: guild.id,
    userId: member.id,
    channelId: message?.channelId,
    messageId: message?.id,
    content: message?.content,
    attachments: message ? [...message.attachments.values()].map((a) => a.url) : [],
    actionTaken: 'pending', // обновим ниже, когда решим действие
  });

  addInfraction({
    guildId: guild.id,
    userId: member.id,
    type,
    weight,
    reason: reasonText,
    moderatorId: null, // null = автомод, не человек
    evidenceId,
  });

  const score = getActiveScore(guild.id, member.id, config.automod.decayMs);
  const { thresholds } = config.automod;

  const evidence = {
    content: message?.content,
    attachments: message ? [...message.attachments.values()].map((a) => a.url) : [],
    channelId: message?.channelId,
  };

  let action = null;

  if (score >= thresholds.ban) {
    action = 'banned';
    await member.ban({ reason: `AutoMod: накоплено ${score} баллов нарушений. ${reasonText}` }).catch(() => {});
  } else if (score >= thresholds.kick) {
    action = 'kicked';
    await member.kick(`AutoMod: накоплено ${score} баллов нарушений. ${reasonText}`).catch(() => {});
  } else if (score >= thresholds.mute) {
    action = 'muted';
    await member.timeout(config.automod.muteDurationMs, `AutoMod: ${reasonText}`).catch(() => {});
  } else if (score >= thresholds.warn) {
    action = 'warned';
    // Предупреждение без реального действия Discord API — просто фиксируется в логах
    // и (опционально) можно уведомить юзера в личку.
  }

  if (action) {
    await logModAction(guild, {
      action,
      targetUser: member.user,
      reason: reasonText,
      moderator: 'AutoMod',
      evidence,
      score,
    });
  }

  return { score, action };
}

module.exports = { handleViolation };
