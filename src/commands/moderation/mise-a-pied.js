const { SlashCommandBuilder } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed, infoEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId, formatDiscordTimestamp } = require("../../utils/db");
const { parseDuration, formatDuration } = require("../../utils/dates");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mise-a-pied")
    .setDescription("Modération interne - Mettre un agent en mise à pied")
    .addUserOption((opt) =>
      opt
        .setName("agent")
        .setDescription("L'agent à suspendre")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("duree")
        .setDescription("Durée (ex: 2j, 24h, 30m)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("raison")
        .setDescription("Raison de la mise à pied")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_INTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getUser("agent");
    const dureeStr = interaction.options.getString("duree");
    const raison = interaction.options.getString("raison");

    const targetUser = await getUserByDiscordId(targetMember.id);
    if (!targetUser) {
      return interaction.reply({
        embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
        ephemeral: true,
      });
    }

    const dureeMs = parseDuration(dureeStr);
    if (!dureeMs || dureeMs <= 0) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Format de durée invalide. Utilise : `2j`, `24h`, `30m`, `1h30m`"
          ),
        ],
        ephemeral: true,
      });
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + dureeMs);

    const prisma = getPrisma();

    const existingActive = await prisma.miseAPied.findFirst({
      where: {
        userId: targetUser.id,
        isActive: true,
        endDate: { gte: now },
      },
    });

    if (existingActive) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `${targetUser.name} est déjà en mise à pied jusqu'au ${formatDiscordTimestamp(existingActive.endDate, "F")}.`
          ),
        ],
        ephemeral: true,
      });
    }

    const mise = await prisma.miseAPied.create({
      data: {
        userId: targetUser.id,
        authorId: user.id,
        reason: raison,
        startDate: now,
        endDate,
      },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Mise à pied enregistrée",
          [
            `**Agent :** ${targetUser.name}`,
            `**Durée :** ${formatDuration(dureeMs)}`,
            `**Du :** ${formatDiscordTimestamp(now, "F")}`,
            `**Au :** ${formatDiscordTimestamp(endDate, "F")}`,
            `**Raison :** ${raison}`,
            `**Par :** ${user.name}`,
            "",
            "🔒 L'accès au compte sera bloqué pendant cette période.",
          ].join("\n")
        ),
      ],
    });
  },
};
