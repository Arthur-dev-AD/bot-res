const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Salut tout le monde !"),

  async execute(interaction) {
    await interaction.reply(`Salut ${interaction.user} ! 👋`);
  },
};
