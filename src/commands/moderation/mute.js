const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getUserByDiscordId } = require("../../utils/db");
const { parseDuration, formatDuration } = require("../../utils/dates");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Modération externe - Muter un membre")
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Le membre à muter")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("duree")
        .setDescription("Durée du mute (ex: 10m, 1h, 2j)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du mute").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_EXTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getMember("membre");
    const dureeStr = interaction.options.getString("duree");
    const raison = interaction.options.getString("raison") || "Non précisé";

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Ce membre n'est pas dans le serveur.")],
        ephemeral: true,
      });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({
        embeds: [errorEmbed("Tu ne peux pas te muter toi-même.")],
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
            "Tu ne peux pas muter quelqu'un avec un rôle égal ou supérieur au tien."
          ),
        ],
        ephemeral: true,
      });
    }

    const dureeMs = parseDuration(dureeStr);
    if (!dureeMs || dureeMs <= 0) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Format de durée invalide. Utilise : `10m`, `1h`, `2j`, `1h30m`"
          ),
        ],
        ephemeral: true,
      });
    }

    const MAX_MUTE = 28 * 24 * 60 * 60 * 1000;
    if (dureeMs > MAX_MUTE) {
      return interaction.reply({
        embeds: [errorEmbed("La durée maximale est de 28 jours.")],
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(dureeMs, `${raison} | Par: ${user.name}`);

      const prisma = require("../../db/prisma").getPrisma();
      const targetUser = await getUserByDiscordId(targetMember.id);
      if (targetUser) {
        await prisma.punishment.create({
          data: {
            userId: targetUser.id,
            type: "MUTE",
            reason: raison,
            duration: dureeMs,
            expiresAt: new Date(Date.now() + dureeMs),
          },
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Membre muté",
            [
              `**Membre :** ${targetMember.user.tag}`,
              `**Durée :** ${formatDuration(dureeMs)}`,
              `**Raison :** ${raison}`,
              `**Par :** ${user.name}`,
            ].join("\n")
          ),
        ],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [
          errorEmbed(`Impossible de muter ce membre: ${error.message}`),
        ],
        ephemeral: true,
      });
    }
  },
};
