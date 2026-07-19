const { SlashCommandBuilder } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blame")
    .setDescription("Modération interne - Mettre un blame à un agent")
    .addUserOption((opt) =>
      opt.setName("agent").setDescription("L'agent à blamer").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du blame").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("severite")
        .setDescription("Sévérité")
        .setRequired(false)
        .addChoices(
          { name: "Information", value: "INFO" },
          { name: "Avertissement", value: "WARNING" },
          { name: "Critique", value: "CRITICAL" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("notes").setDescription("Notes supplémentaires").setRequired(false)
    ),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_INTERNAL);
    if (!user) return;

    const targetMember = interaction.options.getUser("agent");
    const raison = interaction.options.getString("raison");
    const severite = interaction.options.getString("severite") || "WARNING";
    const notes = interaction.options.getString("notes");

    const targetUser = await getUserByDiscordId(targetMember.id);
    if (!targetUser) {
      return interaction.reply({
        embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
        ephemeral: true,
      });
    }

    const prisma = getPrisma();
    const blame = await prisma.blame.create({
      data: {
        userId: targetUser.id,
        authorId: user.id,
        reason: raison,
        severity: severite,
        notes,
      },
    });

    const blameCount = await prisma.blame.count({
      where: { userId: targetUser.id },
    });

    const severityEmoji = {
      INFO: "ℹ️",
      WARNING: "⚠️",
      CRITICAL: "🔴",
    };

    await interaction.reply({
      embeds: [
        successEmbed(
          "Blame enregistré",
          [
            `${severityEmoji[severite] || "⚠️"} **Blame #${blameCount}** pour **${targetUser.name}**`,
            `**Raison :** ${raison}`,
            `**Sévérité :** ${severite}`,
            notes ? `**Notes :** ${notes}` : null,
            `**Par :** ${user.name}`,
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ],
    });
  },
};
