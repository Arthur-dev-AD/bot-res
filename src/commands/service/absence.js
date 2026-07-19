const { SlashCommandBuilder } = require("discord.js");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { checkCanPerformAction, successEmbed, errorEmbed } = require("../../utils/middleware");
const { formatDiscordTimestamp } = require("../../utils/dates");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("absence")
    .setDescription("Gère tes absences")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Définir une absence")
        .addStringOption((opt) =>
          opt
            .setName("debut")
            .setDescription("Date de début (JJ/MM/AAAA HH:MM)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("fin")
            .setDescription("Date de fin (JJ/MM/AAAA HH:MM)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("raison")
            .setDescription("Raison de l'absence")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("cancel").setDescription("Annuler ton absence active")
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Voir les absences")
        .addUserOption((opt) =>
          opt
            .setName("membre")
            .setDescription("Voir les absences d'un membre")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const user = await checkCanPerformAction(interaction);
    if (!user) return;

    const prisma = getPrisma();
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const debutStr = interaction.options.getString("debut");
      const finStr = interaction.options.getString("fin");
      const raison = interaction.options.getString("raison") || "Non précisé";

      const debut = parseDate(debutStr);
      const fin = parseDate(finStr);

      if (!debut || !fin) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Format de date invalide. Utilise **JJ/MM/AAAA HH:MM** (ex: `19/07/2026 14:00`)"
            ),
          ],
          ephemeral: true,
        });
      }

      if (fin <= debut) {
        return interaction.reply({
          embeds: [errorEmbed("La date de fin doit être après la date de début.")],
          ephemeral: true,
        });
      }

      if (debut < new Date()) {
        return interaction.reply({
          embeds: [errorEmbed("La date de début ne peut pas être dans le passé.")],
          ephemeral: true,
        });
      }

      const existingActive = await prisma.absence.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          cancelled: false,
        },
      });

      if (existingActive) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Tu as déjà une absence active. Annule-la d'abord avec `/absence cancel`."
            ),
          ],
          ephemeral: true,
        });
      }

      const absence = await prisma.absence.create({
        data: {
          userId: user.id,
          startDate: debut,
          endDate: fin,
          reason: raison,
        },
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "Absence enregistrée",
            [
              `**Agent :** ${user.name}`,
              `**Du :** ${formatDiscordTimestamp(debut, "F")}`,
              `**Au :** ${formatDiscordTimestamp(fin, "F")}`,
              `**Raison :** ${raison}`,
              "",
              "🔒 Ton compte sera bloqué pendant cette période.",
            ].join("\n")
          ),
        ],
      });
    } else if (sub === "cancel") {
      const active = await prisma.absence.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          cancelled: false,
        },
      });

      if (!active) {
        return interaction.reply({
          embeds: [errorEmbed("Tu n'as pas d'absence active.")],
          ephemeral: true,
        });
      }

      await prisma.absence.update({
        where: { id: active.id },
        data: { cancelled: true, isActive: false },
      });

      await interaction.reply({
        embeds: [successEmbed("Absence annulée", "Ton absence a été annulée avec succès.")],
      });
    } else if (sub === "list") {
      const targetMember = interaction.options.getUser("membre");
      let targetUser = user;

      if (targetMember) {
        const { getUserByDiscordId: getUD } = require("../../utils/db");
        targetUser = await getUD(targetMember.id);
        if (!targetUser) {
          return interaction.reply({
            embeds: [errorEmbed("Cet utilisateur n'a pas de compte lié.")],
            ephemeral: true,
          });
        }
      }

      const absences = await prisma.absence.findMany({
        where: { userId: targetUser.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (absences.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed("Aucune absence", "Aucune absence enregistrée.")],
          ephemeral: true,
        });
      }

      const list = absences
        .map((a) => {
          const status = a.cancelled
            ? "❌ Annulée"
            : a.isActive
            ? "🟢 Active"
            : "✅ Terminée";
          return `${status} | ${formatDiscordTimestamp(a.startDate, "d")} → ${formatDiscordTimestamp(a.endDate, "d")} | ${a.reason || "N/A"}`;
        })
        .join("\n");

      await interaction.reply({
        embeds: [infoEmbed(`Absences de ${targetUser.name}`, list)],
        ephemeral: true,
      });
    }
  },
};

function parseDate(str) {
  const match = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/
  );
  if (!match) return null;
  const [, day, month, year, hours, minutes] = match;
  return new Date(year, month - 1, day, hours, minutes);
}
