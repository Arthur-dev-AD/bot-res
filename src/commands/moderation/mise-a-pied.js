const { SlashCommandBuilder } = require("discord.js");
const { checkDBPermission, successEmbed, errorEmbed, infoEmbed } = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId, getConfig } = require("../../utils/db");
const { parseDuration, formatDuration, formatDiscordTimestamp } = require("../../utils/dates");
const { getRoleLevel } = require("../../config/roles");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mise-a-pied")
    .setDescription("Modération interne - Gestion des mises à pied")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Mettre un agent en mise à pied")
        .addUserOption((opt) =>
          opt.setName("agent").setDescription("L'agent à suspendre").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("duree").setDescription("Durée (ex: 2j, 24h, 30m)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("raison").setDescription("Raison de la mise à pied").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Annuler la mise à pied d'un agent (Superviseur+)")
        .addUserOption((opt) =>
          opt.setName("agent").setDescription("L'agent à désuspendre").setRequired(true)
        )
    ),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_INTERNAL);
    if (!user) return;

    const sub = interaction.options.getSubcommand();
    const prisma = getPrisma();

    if (sub === "set") {
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
          embeds: [errorEmbed("Format de durée invalide. Utilise : `2j`, `24h`, `30m`, `1h30m`")],
          ephemeral: true,
        });
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + dureeMs);

      const existingActive = await prisma.miseAPied.findFirst({
        where: {
          userId: targetUser.id,
          isActive: true,
          endDate: { gte: now },
        },
      });

      if (existingActive) {
        return interaction.reply({
          embeds: [errorEmbed(`${targetUser.name} est déjà en mise à pied jusqu'au ${formatDiscordTimestamp(existingActive.endDate, "F")}.`)],
          ephemeral: true,
        });
      }

      let addedRoleId = null;
      const miseRoleId = await getConfig("MISE_A_PIED_ROLE");

      if (miseRoleId) {
        try {
          const member = await interaction.guild.members.fetch(targetMember.id);
          if (member) {
            const role = interaction.guild.roles.cache.get(miseRoleId);
            if (role && !member.roles.cache.has(miseRoleId)) {
              await member.roles.add(miseRoleId);
              addedRoleId = miseRoleId;
            }
          }
        } catch (err) {
          console.error("Erreur lors de l'ajout du rôle de mise à pied:", err);
        }
      }

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { status: "BLOCKED" },
      });

      await prisma.miseAPied.create({
        data: {
          userId: targetUser.id,
          authorId: user.id,
          reason: raison,
          startDate: now,
          endDate,
          addedRoleId,
        },
      });

      const lines = [
        `**Agent :** ${targetUser.name}`,
        `**Durée :** ${formatDuration(dureeMs)}`,
        `**Du :** ${formatDiscordTimestamp(now, "F")}`,
        `**Au :** ${formatDiscordTimestamp(endDate, "F")}`,
        `**Raison :** ${raison}`,
        `**Par :** ${user.name}`,
        "",
        "🔒 Compte bloqué pendant cette période.",
      ];

      if (addedRoleId) {
        const role = interaction.guild.roles.cache.get(addedRoleId);
        lines.push(`🎭 Rôle **${role ? role.name : "de mise à pied"}** attribué.`);
      }

      await interaction.reply({
        embeds: [successEmbed("Mise à pied enregistrée", lines.join("\n"))],
      });

    } else if (sub === "cancel") {
      if (getRoleLevel(user.role) < getRoleLevel("SUPERVISEUR")) {
        return interaction.reply({
          embeds: [errorEmbed("Tu dois être Superviseur ou plus pour annuler une mise à pied.")],
          ephemeral: true,
        });
      }

      const targetMember = interaction.options.getUser("agent");

      const targetUser = await getUserByDiscordId(targetMember.id);
      if (!targetUser) {
        return interaction.reply({
          embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
          ephemeral: true,
        });
      }

      const active = await prisma.miseAPied.findFirst({
        where: {
          userId: targetUser.id,
          isActive: true,
        },
      });

      if (!active) {
        return interaction.reply({
          embeds: [errorEmbed(`${targetUser.name} n'a pas de mise à pied active.`)],
          ephemeral: true,
        });
      }

      await prisma.miseAPied.update({
        where: { id: active.id },
        data: { isActive: false },
      });

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { status: "ACTIVE" },
      });

      const lines = [`La mise à pied de **${targetUser.name}** a été annulée.`];

      if (active.addedRoleId) {
        try {
          const member = await interaction.guild.members.fetch(targetMember.id);
          if (member) {
            const role = interaction.guild.roles.cache.get(active.addedRoleId);
            if (role) {
              await member.roles.remove(active.addedRoleId);
              lines.push(`🎭 Rôle **${role.name}** retiré.`);
            }
          }
        } catch (err) {
          console.error("Erreur lors du retrait du rôle de mise à pied:", err);
          lines.push("⚠️ Impossible de retirer le rôle automatiquement. Contacte un admin.");
        }
      }

      await interaction.reply({
        embeds: [successEmbed("Mise à pied annulée", lines.join("\n"))],
      });
    }
  },
};
