const { logSecurityAudit } = require('../database/records');
const { logSecurityEvent } = require('../modules/logging/logger');

/**
 * Проверяет, что у интеракции есть все нужные Discord permissions, ПЛЮС логирует
 * попытку использования привилегированной команды (даже успешную) в security-аудит.
 * Двойная проверка важна, потому что Discord permission checks в UI (видимость
 * команды) можно обойти при рассинхронизации кэша — код должен проверять сам.
 */
async function requirePermissions(interaction, permissionsList, actionName) {
  const hasAll = permissionsList.every((perm) => interaction.member.permissions.has(perm));

  if (!hasAll) {
    logSecurityAudit({
      guildId: interaction.guild.id,
      actorId: interaction.user.id,
      action: 'permission_denied',
      details: `Попытка выполнить "${actionName}" без нужных прав.`,
    });
    await logSecurityEvent(interaction.guild, {
      action: 'permission_denied',
      actor: interaction.user,
      details: `Попытка выполнить команду "${actionName}" без достаточных прав.`,
    });
    await interaction.reply({ content: 'У тебя недостаточно прав для этой команды.', ephemeral: true });
    return false;
  }

  logSecurityAudit({
    guildId: interaction.guild.id,
    actorId: interaction.user.id,
    action: 'privileged_command_used',
    details: actionName,
  });

  return true;
}

module.exports = { requirePermissions };
