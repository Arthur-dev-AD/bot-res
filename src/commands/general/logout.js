const { SlashCommandBuilder } = require("discord.js");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { successEmbed, errorEmbed } = require("../../utils/middleware");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logout")
    .setDescription("Déconnecte ton compte RES Systems du bot"),

  async execute(interaction) {
    const user = await getUserByDiscordId(interaction.user.id);
    if (!user) {
      return interaction.reply({
        embeds: [errorEmbed("Tu n'as pas de compte lié.")],
        ephemeral: true,
      });
    }

    const prisma = getPrisma();

    await prisma.user.update({
      where: { id: user.id },
      data: { discordId: null },
    });

    await prisma.oAuthToken.deleteMany({
      where: { userId: user.id },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Déconnecté",
          `Ton compte **${user.name}** a été délié du bot Discord.`
        ),
      ],
      ephemeral: true,
    });
  },
};
