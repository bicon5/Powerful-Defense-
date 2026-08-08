const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { logRaidDetected, logSecurityEvent } = require('../logging/logger');
const { logSecurityAudit } = require('../../database/records');

// guildId -> [timestamps джойнов]
const joinLog = new Map();
// guildId -> true, если сейчас включён lockdown (чтобы не триггерить повторно)
const lockdownState = new Map();

/**
 * Вызывается на каждый guildMemberAdd. Проверяет скорость вступлений и
 * возраст аккаунта. При превышении порога — включает временный lockdown
 * (закрывает возможность писать в @everyone) и логирует событие.
 */
async function trackJoin(member) {
  const guild = member.guild;
  const { joinVelocity, minAccountAgeMs } = config.antiraid;

  const now = Date.now();
  const timestamps = (joinLog.get(guild.id) || []).filter((t) => now - t < joinVelocity.windowMs);
  timestamps.push(now);
  joinLog.set(guild.id, timestamps);

  // Проверка возраста аккаунта — юзеры младше порога получают карантинную метку
  // в security-лог (без авто-кика по умолчанию, чтобы не банить реальных новых юзеров
  // на пустом месте; используй это как сигнал для ручной проверки или ужесточи при желании)
  const accountAge = now - member.user.createdTimestamp;
  const isNewAccount = accountAge < minAccountAgeMs;

  if (isNewAccount) {
    await logSecurityEvent(guild, {
      action: 'new_account_join',
      actor: member.user,
      details: `Аккаунт создан ${Math.round(accountAge / (1000 * 60 * 60 * 24))} дн. назад — младше порога.`,
    });
  }

  if (timestamps.length >= joinVelocity.maxJoins && !lockdownState.get(guild.id)) {
    lockdownState.set(guild.id, true);
    await triggerLockdown(guild, timestamps.length, joinVelocity.windowMs);
  }
}

async function triggerLockdown(guild, joinCount, windowMs) {
  await logRaidDetected(guild, { joinCount, windowMs, ownerId: config.ownerId });
  logSecurityAudit({ guildId: guild.id, actorId: 'AutoMod', action: 'lockdown_triggered', details: `${joinCount} joins/${windowMs}ms` });

  const everyoneRole = guild.roles.everyone;
  try {
    await everyoneRole.setPermissions(
      everyoneRole.permissions.remove(PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreateInstantInvite)
    );
  } catch (err) {
    console.error('[ANTIRAID] Не удалось применить lockdown (не хватает прав?):', err.message);
    return;
  }

  setTimeout(() => liftLockdown(guild), config.antiraid.lockdownDurationMs);
}

async function liftLockdown(guild) {
  const everyoneRole = guild.roles.everyone;
  try {
    await everyoneRole.setPermissions(
      everyoneRole.permissions.add(PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreateInstantInvite)
    );
    await logSecurityEvent(guild, { action: 'lockdown_lifted', actor: 'AutoMod', details: 'Lockdown снят автоматически по таймеру.' });
  } catch (err) {
    console.error('[ANTIRAID] Не удалось снять lockdown:', err.message);
  } finally {
    lockdownState.set(guild.id, false);
  }
}

module.exports = { trackJoin };
