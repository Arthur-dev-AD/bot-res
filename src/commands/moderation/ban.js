const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getUserByDiscordId } = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Modération externe - Bannir un membre du Discord")
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Le membre à bannir")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du ban").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("jours-messages")
        .setDescription("Jours de messages à supprimer (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_EXTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getMember("membre");
    const raison = interaction.options.getString("raison") || "Non précisé";
    const deleteDays = interaction.options.getInteger("jours-messages") || 0;

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Ce membre n'est pas dans le serveur.")],
        ephemeral: true,
      });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({
        embeds: [errorEmbed("Tu ne peux pas te bannir toi-même.")],
        ephemeral: true,
      });
    }

    if (
      targetMember.roles.highest.position >=
      interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Tu ne peux pas bannir quelqu'un avec un rôle égal ou supérieur au tien."
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      await targetMember.ban({
        deleteMessageSeconds: deleteDays * 86400,
        reason: `${raison} | Par: ${user.name}`,
      });

      const prisma = require("../../db/prisma").getPrisma();
      const targetUser = await getUserByDiscordId(targetMember.id);
      if (targetUser) {
        await prisma.punishment.create({
          data: {
            userId: targetUser.id,
            type: "BAN",
            reason: raison,
          },
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Membre banni",
            [
              `**Membre :** ${targetMember.user.tag}`,
              `**Raison :** ${raison}`,
              `**Messages supprimés :** ${deleteDays} jour(s)`,
              `**Par :** ${user.name}`,
            ].join("\n")
          ),
        ],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [
          errorEmbed(`Impossible de bannir ce membre: ${error.message}`),
        ],
        ephemeral: true,
      });
    }
  },
};
