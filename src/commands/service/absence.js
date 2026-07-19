const { SlashCommandBuilder } = require("discord.js");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId, getConfig } = require("../../utils/db");
const { checkCanPerformAction, successEmbed, errorEmbed, infoEmbed } = require("../../utils/middleware");
const { formatDiscordTimestamp } = require("../../utils/dates");
const { getRoleLevel } = require("../../config/roles");

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
        .addUserOption((opt) =>
          opt
            .setName("personne")
            .setDescription("Définir l'absence de quelqu'un d'autre (Superviseur+)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Annuler une absence active")
        .addUserOption((opt) =>
          opt
            .setName("personne")
            .setDescription("Annuler l'absence de quelqu'un d'autre (Superviseur+)")
            .setRequired(false)
        )
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
      const targetDiscordUser = interaction.options.getUser("personne");

      let targetUser = user;
      let targetMember = interaction.member;

      if (targetDiscordUser) {
        if (getRoleLevel(user.role) < getRoleLevel("SUPERVISEUR")) {
          return interaction.reply({
            embeds: [errorEmbed("Tu dois être Superviseur ou plus pour gérer les absences des autres.")],
            ephemeral: true,
          });
        }
        targetUser = await getUserByDiscordId(targetDiscordUser.id);
        if (!targetUser) {
          return interaction.reply({
            embeds: [errorEmbed("Cet utilisateur n'a pas de compte RES Systems lié.")],
            ephemeral: true,
          });
        }
        targetMember = await interaction.guild.members.fetch(targetDiscordUser.id).catch(() => null);
      }

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
          userId: targetUser.id,
          isActive: true,
          cancelled: false,
        },
      });

      if (existingActive) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              targetDiscordUser
                ? `${targetUser.name} a déjà une absence active.`
                : "Tu as déjà une absence active. Annule-la d'abord avec `/absence cancel`."
            ),
          ],
          ephemeral: true,
        });
      }

      let removedRoleId = null;
      const absenceRoleId = await getConfig("ABSENCE_ROLE");

      if (absenceRoleId && targetMember) {
        try {
          const role = interaction.guild.roles.cache.get(absenceRoleId);
          if (role && targetMember.roles.cache.has(absenceRoleId)) {
            await targetMember.roles.remove(absenceRoleId);
            removedRoleId = absenceRoleId;
          }
        } catch (err) {
          console.error("Erreur lors du retrait du rôle d'absence:", err);
        }
      }

      const absence = await prisma.absence.create({
        data: {
          userId: targetUser.id,
          startDate: debut,
          endDate: fin,
          reason: raison,
          removedRoleId,
        },
      });

      const lines = [
        `**Agent :** ${targetUser.name}`,
        `**Du :** ${formatDiscordTimestamp(debut, "F")}`,
        `**Au :** ${formatDiscordTimestamp(fin, "F")}`,
        `**Raison :** ${raison}`,
        "",
        targetDiscordUser ? "🔒 Son compte sera bloqué pendant cette période." : "🔒 Ton compte sera bloqué pendant cette période.",
      ];

      if (removedRoleId) {
        const role = interaction.guild.roles.cache.get(removedRoleId);
        lines.push(`🎭 Rôle **${role ? role.name : "d'absence"}** retiré temporairement.`);
      }

      await interaction.reply({
        embeds: [successEmbed("Absence enregistrée", lines.join("\n"))],
      });
    } else if (sub === "cancel") {
      const targetDiscordUser = interaction.options.getUser("personne");

      let targetUser = user;
      let targetMember = interaction.member;

      if (targetDiscordUser) {
        if (getRoleLevel(user.role) < getRoleLevel("SUPERVISEUR")) {
          return interaction.reply({
            embeds: [errorEmbed("Tu dois être Superviseur ou plus pour gérer les absences des autres.")],
            ephemeral: true,
          });
        }
        targetUser = await getUserByDiscordId(targetDiscordUser.id);
        if (!targetUser) {
          return interaction.reply({
            embeds: [errorEmbed("Cet utilisateur n'a pas de compte RES Systems lié.")],
            ephemeral: true,
          });
        }
        targetMember = await interaction.guild.members.fetch(targetDiscordUser.id).catch(() => null);
      }

      const active = await prisma.absence.findFirst({
        where: {
          userId: targetUser.id,
          isActive: true,
          cancelled: false,
        },
      });

      if (!active) {
        return interaction.reply({
          embeds: [errorEmbed(targetDiscordUser ? `${targetUser.name} n'a pas d'absence active.` : "Tu n'as pas d'absence active.")],
          ephemeral: true,
        });
      }

      await prisma.absence.update({
        where: { id: active.id },
        data: { cancelled: true, isActive: false },
      });

      const lines = [targetDiscordUser ? `L'absence de **${targetUser.name}** a été annulée.` : "Ton absence a été annulée avec succès."];

      if (active.removedRoleId && targetMember) {
        try {
          const role = interaction.guild.roles.cache.get(active.removedRoleId);
          if (role) {
            await targetMember.roles.add(active.removedRoleId);
            lines.push(`🎭 Rôle **${role.name}** remis.`);
          }
        } catch (err) {
          console.error("Erreur lors de la remise du rôle d'absence:", err);
          lines.push("⚠️ Impossible de remettre le rôle automatiquement. Contacte un admin.");
        }
      }

      await interaction.reply({
        embeds: [successEmbed("Absence annulée", lines.join("\n"))],
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
