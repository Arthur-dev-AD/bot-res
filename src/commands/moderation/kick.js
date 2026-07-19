const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getUserByDiscordId } = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Modération externe - Expulser un membre du Discord")
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Le membre à expulser")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du kick").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_EXTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getMember("membre");
    const raison = interaction.options.getString("raison") || "Non précisé";

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Ce membre n'est pas dans le serveur.")],
        ephemeral: true,
      });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({
        embeds: [errorEmbed("Tu ne peux pas te kick toi-même.")],
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
            "Tu ne peux pas expulser quelqu'un avec un rôle égal ou supérieur au tien."
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      await targetMember.kick(raison);

      const prisma = require("../../db/prisma").getPrisma();
      const targetUser = await getUserByDiscordId(targetMember.id);
      if (targetUser) {
        await prisma.punishment.create({
          data: {
            userId: targetUser.id,
            type: "KICK",
            reason: raison,
          },
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Membre expulsé",
            [
              `**Membre :** ${targetMember.user.tag}`,
              `**Raison :** ${raison}`,
              `**Par :** ${user.name}`,
            ].join("\n")
          ),
        ],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `Impossible d'expulser ce membre: ${error.message}`
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
