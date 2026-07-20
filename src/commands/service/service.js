const { SlashCommandBuilder } = require("discord.js");
const { checkCanPerformAction, checkNotAbsent, successEmbed, errorEmbed, infoEmbed } = require("../../utils/middleware");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { updateServiceCounts } = require("../../events/serviceAnnouncement");
const { getCitiesForAutocomplete } = require("../../utils/autocomplete");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("service")
    .setDescription("Gestion de ton service")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Commencer ton service")
        .addStringOption((opt) =>
          opt
            .setName("antenne")
            .setDescription("Nom de l'antenne")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Terminer ton service")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Voir ton statut de service")
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await getCitiesForAutocomplete(focused);
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const prisma = getPrisma();
    const sub = interaction.options.getSubcommand();

    let user;
    if (sub === "start") {
      user = await getUserByDiscordId(interaction.user.id);
      if (!user) {
        await interaction.reply({
          content: "❌ Compte non trouvé. Utilise `/login` pour connecter ton compte.",
          ephemeral: true,
        });
        return;
      }
    } else {
      user = await checkCanPerformAction(interaction);
      if (!user) return;
      if (await checkNotAbsent(interaction, user) === false) return;
    }

    if (sub === "start") {
      const antenneStr = interaction.options.getString("antenne");

      const city = await prisma.city.findFirst({
        where: { name: { contains: antenneStr, mode: "insensitive" } },
      });

      if (!city) {
        return interaction.reply({
          embeds: [errorEmbed(`Antenne "${antenneStr}" introuvable. Utilise l'autocomplete pour choisir.`)],
          ephemeral: true,
        });
      }

      const activeService = await prisma.serviceLog.findFirst({
        where: {
          agentId: user.id,
          status: "ACTIVE",
        },
      });

      if (activeService) {
        return interaction.reply({
          embeds: [errorEmbed("Tu as déjà un service en cours. Termine-le d'abord.")],
          ephemeral: true,
        });
      }

      const service = await prisma.serviceLog.create({
        data: {
          agentId: user.id,
          agentName: user.name || interaction.user.tag,
          cityId: city.id,
          status: "ACTIVE",
        },
      });

      await prisma.actionLog.create({
        data: {
          agentId: user.id,
          agentName: user.name || interaction.user.tag,
          serviceLogId: service.id,
          actionType: "SERVICE_START",
          description: `Service commencé à ${city.name}`,
        },
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "Service commencé",
            [
              `**Agent :** ${user.name}`,
              `**Antenne :** ${city.name}`,
              `**Début :** <t:${Math.floor(Date.now() / 1000)}:R>`,
            ].join("\n")
          ),
        ],
      });

      try { await updateServiceCounts(interaction.client); } catch (e) {}
    } else if (sub === "stop") {
      const activeService = await prisma.serviceLog.findFirst({
        where: { agentId: user.id, status: "ACTIVE" },
      });

      if (!activeService) {
        return interaction.reply({
          embeds: [errorEmbed("Tu n'as pas de service en cours.")],
          ephemeral: true,
        });
      }

      const endTime = new Date();
      const duration = endTime - activeService.startTime;

      await prisma.serviceLog.update({
        where: { id: activeService.id },
        data: { endTime, status: "COMPLETED" },
      });

      await prisma.actionLog.create({
        data: {
          agentId: user.id,
          agentName: user.name || interaction.user.tag,
          serviceLogId: activeService.id,
          actionType: "SERVICE_END",
          description: `Service terminé. Durée: ${Math.floor(duration / 60000)} min`,
        },
      });

      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);

      await interaction.reply({
        embeds: [
          successEmbed(
            "Service terminé",
            [`**Agent :** ${user.name}`, `**Durée :** ${hours}h ${minutes}m`].join("\n")
          ),
        ],
      });

      try { await updateServiceCounts(interaction.client); } catch (e) {}
    } else if (sub === "status") {
      const activeService = await prisma.serviceLog.findFirst({
        where: { agentId: user.id, status: "ACTIVE" },
        include: { city: true },
      });

      if (!activeService) {
        return interaction.reply({
          embeds: [infoEmbed("Service", "Tu n'as pas de service en cours.")],
          ephemeral: true,
        });
      }

      const duration = Date.now() - activeService.startTime.getTime();
      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);

      await interaction.reply({
        embeds: [
          infoEmbed(
            "Service en cours",
            [
              `**Agent :** ${user.name}`,
              `**Antenne :** ${activeService.city?.name || "N/A"}`,
              `**Durée :** ${hours}h ${minutes}m`,
              `**Début :** <t:${Math.floor(activeService.startTime.getTime() / 1000)}:R>`,
            ].join("\n")
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
