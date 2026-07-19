const { SlashCommandBuilder } = require("discord.js");
const { checkDBPermission, infoEmbed, errorEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { formatDiscordTimestamp } = require("../../utils/dates");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("punishments")
    .setDescription("Voir l'historique des punitions")
    .addUserOption((opt) =>
      opt
        .setName("agent")
        .setDescription("Voir les punitions d'un agent")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_INTERNAL);
    if (!user) return;

    const target = interaction.options.getUser("agent");
    const prisma = getPrisma();

    const where = {};
    if (target) {
      const targetUser = await getUserByDiscordId(target.id);
      if (!targetUser) {
        return interaction.reply({
          embeds: [errorEmbed("Cet agent n'a pas de compte lié.")],
          ephemeral: true,
        });
      }
      where.userId = targetUser.id;
    }

    const punishments = await prisma.punishment.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const blames = await prisma.blame.findMany({
      where: target ? { userId: (await getUserByDiscordId(target.id))?.id } : {},
      include: {
        user: { select: { name: true } },
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (punishments.length === 0 && blames.length === 0) {
      return interaction.reply({
        embeds: [infoEmbed("Punitions", "Aucune punition enregistrée.")],
        ephemeral: true,
      });
    }

    let description = "";

    if (punishments.length > 0) {
      description += "**制裁 Punitions Discord**\n";
      description += punishments
        .map((p) => {
          const icon = { KICK: "🚪", BAN: "🔨", MUTE: "🔇" }[p.type] || "📋";
          return `${icon} **${p.user.name}** | ${p.type} | ${p.reason} | ${formatDiscordTimestamp(p.createdAt, "d")}`;
        })
        .join("\n");
    }

    if (blames.length > 0) {
      if (description) description += "\n\n";
      description += "**⚠️ Blames internes**\n";
      description += blames
        .map((b, i) => {
          const icon = { INFO: "ℹ️", WARNING: "⚠️", CRITICAL: "🔴" }[b.severity] || "⚠️";
          return `${icon} **#${i + 1}** ${b.user.name} | ${b.reason} | Par: ${b.author.name} | ${formatDiscordTimestamp(b.createdAt, "d")}`;
        })
        .join("\n");
    }

    await interaction.reply({
      embeds: [infoEmbed("Historique des punitions", description)],
      ephemeral: true,
    });
  },
};
