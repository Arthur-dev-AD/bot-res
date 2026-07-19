const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Modération externe - Retirer le mute d'un membre")
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Le membre à unmute")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_EXTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getMember("membre");

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Ce membre n'est pas dans le serveur.")],
        ephemeral: true,
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [errorEmbed("Ce membre n'est pas muté.")],
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(null, `Unmute par ${user.name}`);

      await interaction.reply({
        embeds: [
          successEmbed(
            "Membre unmute",
            `**${targetMember.user.tag}** a été unmute par **${user.name}**.`
          ),
        ],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [
          errorEmbed(`Impossible d'unmute ce membre: ${error.message}`),
        ],
        ephemeral: true,
      });
    }
  },
};
