const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { requirePermissions } = require('../../utils/permissions');
const { getInfractionHistory, getEvidence } = require('../../database/records');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Показать историю нарушений участника')
    .addUserOption((opt) => opt.setName('user').setDescription('Чью историю посмотреть').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const allowed = await requirePermissions(interaction, [PermissionFlagsBits.ModerateMembers], '/history');
    if (!allowed) return;

    const targetUser = interaction.options.getUser('user');
    const records = getInfractionHistory(interaction.guild.id, targetUser.id, 10);

    if (records.length === 0) {
      return interaction.reply({ content: `У ${targetUser.tag} нет зафиксированных нарушений.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`История нарушений: ${targetUser.tag}`)
      .setColor(0x3498db)
      .setFooter({ text: `Последние ${records.length} записей` });

    for (const record of records) {
      const date = new Date(record.created_at).toLocaleString('ru-RU');
      const moderator = record.moderator_id ? `<@${record.moderator_id}>` : 'AutoMod';
      let value = `Тип: ${record.type} | Вес: ${record.weight} | Модератор: ${moderator}\nПричина: ${record.reason || '—'}`;

      if (record.evidence_id) {
        const evidence = getEvidence(record.evidence_id);
        if (evidence?.content_snapshot) {
          const snippet = evidence.content_snapshot.slice(0, 200);
          value += `\nДоказательство: \`${snippet}\``;
        }
      }

      embed.addFields({ name: date, value });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
