const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime des messages")
    .addIntegerOption((option) =>
      option
        .setName("nombre")
        .setDescription("Nombre de messages à supprimer (1-100)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger("nombre");

    if (amount < 1 || amount > 100) {
      return interaction.reply("Choisis un nombre entre 1 et 100.");
    }

    if (!interaction.member.permissions.has("ManageMessages")) {
      return interaction.reply(
        "Tu n'as pas la permission de supprimer des messages."
      );
    }

    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply(`${deleted.size} message(s) supprimé(s).`);
  },
};
