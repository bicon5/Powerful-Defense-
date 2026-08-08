const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermissions } = require('../../utils/permissions');
const { checkCooldown } = require('../../utils/cooldowns');
const { addInfraction, saveEvidence, getActiveScore } = require('../../database/records');
const { logModAction } = require('../../modules/logging/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение участнику')
    .addUserOption((opt) => opt.setName('user').setDescription('Кому выдать варн').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Причина').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const allowed = await requirePermissions(interaction, [PermissionFlagsBits.ModerateMembers], '/warn');
    if (!allowed) return;

    const cooldownLeft = checkCooldown('warn', interaction.user.id, 3);
    if (cooldownLeft > 0) {
      return interaction.reply({ content: `Подожди ${cooldownLeft} сек.`, ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const evidenceId = saveEvidence({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      content: `Ручной варн модератором. Причина: ${reason}`,
      actionTaken: 'warned',
    });

    addInfraction({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      type: 'manual',
      weight: config.automod.weights.spam, // используем условный вес, чтобы варн тоже влиял на общий счёт
      reason,
      moderatorId: interaction.user.id,
      evidenceId,
    });

    const score = getActiveScore(interaction.guild.id, targetUser.id, config.automod.decayMs);

    await logModAction(interaction.guild, {
      action: 'warned',
      targetUser,
      reason,
      moderator: interaction.user,
      score,
    });

    await interaction.reply({ content: `${targetUser.tag} получил(а) предупреждение. Текущий счёт: ${score}.`, ephemeral: true });
  },
};
