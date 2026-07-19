const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Répond avec la latence du bot"),

  async execute(interaction, client) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(
      `Pong ! Latence API : ${roundtrip}ms | WebSocket : ${client.ws.ping}ms`
    );
  },
};
