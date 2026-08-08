const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { requirePermissions } = require('../../utils/permissions');
const { checkCooldown } = require('../../utils/cooldowns');
const { addInfraction, saveEvidence } = require('../../database/records');
const { logModAction } = require('../../modules/logging/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Забанить участника (требует подтверждения)')
    .addUserOption((opt) => opt.setName('user').setDescription('Кого забанить').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Причина бана').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const allowed = await requirePermissions(interaction, [PermissionFlagsBits.BanMembers], '/ban');
    if (!allowed) return;

    const cooldownLeft = checkCooldown('ban', interaction.user.id, 5);
    if (cooldownLeft > 0) {
      return interaction.reply({ content: `Подожди ${cooldownLeft} сек. перед следующей командой.`, ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    // Валидация: нельзя забанить самого себя или юзера с ролью выше/равной модератору
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: 'Нельзя забанить самого себя.', ephemeral: true });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const executorMember = interaction.member;
      if (targetMember.roles.highest.position >= executorMember.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: 'Нельзя забанить участника с ролью выше или равной твоей.', ephemeral: true });
      }
    }

    // Деструктивное действие — confirmation step через кнопки, а не сразу выполняем
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ban_confirm_${targetUser.id}`).setLabel('Подтвердить бан').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ban_cancel').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({
      content: `Забанить **${targetUser.tag}**?\nПричина: ${reason}`,
      components: [confirmRow],
      ephemeral: true,
      withResponse: true,
    });

    const collector = reply.resource.message.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({ content: 'Эта кнопка не для тебя.', ephemeral: true });
      }

      if (btnInteraction.customId === 'ban_cancel') {
        await btnInteraction.update({ content: 'Бан отменён.', components: [] });
        return;
      }

      if (btnInteraction.customId === `ban_confirm_${targetUser.id}`) {
        const evidenceId = saveEvidence({
          guildId: interaction.guild.id,
          userId: targetUser.id,
          content: `Ручной бан модератором. Причина: ${reason}`,
          actionTaken: 'banned',
        });

        addInfraction({
          guildId: interaction.guild.id,
          userId: targetUser.id,
          type: 'manual',
          weight: 999, // ручной бан не участвует в decay-логике автомода
          reason,
          moderatorId: interaction.user.id,
          evidenceId,
        });

        await interaction.guild.members.ban(targetUser.id, { reason: `${reason} (модератор: ${interaction.user.tag})` }).catch(async (err) => {
          await btnInteraction.update({ content: `Не удалось забанить: ${err.message}`, components: [] });
          return;
        });

        await logModAction(interaction.guild, {
          action: 'banned',
          targetUser,
          reason,
          moderator: interaction.user,
        });

        await btnInteraction.update({ content: `${targetUser.tag} забанен.`, components: [] });
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Время на подтверждение истекло.', components: [] }).catch(() => {});
      }
    });
  },
};
