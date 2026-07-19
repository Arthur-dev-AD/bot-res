const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  checkDBPermission,
  errorEmbed,
} = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getCitiesForAutocomplete } = require("../../utils/autocomplete");
const { getDefconColor, getDefconInfo } = require("../../config/defcon");
const { updateDefconDisplay, buildDefconEmbed } = require("../../utils/defconDisplay");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("defcon")
    .setDescription("Gestion centralisée du DEFCON")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Définir le niveau DEFCON")
        .addIntegerOption((opt) =>
          opt
            .setName("niveau")
            .setDescription("Niveau DEFCON (1-5)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addStringOption((opt) =>
          opt
            .setName("antenne")
            .setDescription("Antenne")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Voir le DEFCON actuel")
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await getCitiesForAutocomplete(focused);
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MANAGE_DEFCON);
    if (!user) return;

    const prisma = getPrisma();
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const niveau = interaction.options.getInteger("niveau");
      const antenne = interaction.options.getString("antenne");
      const info = getDefconInfo(niveau);

      const city = await prisma.city.findFirst({
        where: { name: { contains: antenne, mode: "insensitive" } },
      });

      if (!city) {
        return interaction.reply({
          embeds: [errorEmbed(`Antenne "${antenne}" introuvable.`)],
          ephemeral: true,
        });
      }

      await prisma.city.update({
        where: { id: city.id },
        data: { defcon: String(niveau) },
      });

      const embed = new EmbedBuilder()
        .setColor(getDefconColor(niveau))
        .setTitle(`${info.emoji} DEFCON ${niveau} — ${info.name}`)
        .setDescription(info.description)
        .addFields(
          { name: "Antenne", value: city.name, inline: true },
          { name: "Statut", value: info.status, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await updateDefconDisplay(interaction.client).catch(() => {});
    } else if (sub === "status") {
      const { mainEmbed, legendEmbed } = await buildDefconEmbed();
      await interaction.reply({ embeds: [mainEmbed, legendEmbed] });
    }
  },
};
