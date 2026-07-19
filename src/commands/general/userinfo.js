const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Affiche les infos d'un utilisateur")
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("Le membre à inspecter")
        .setRequired(false)
    ),

  async execute(interaction) {
    const member =
      interaction.options.getMember("membre") || interaction.member;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Informations sur ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Pseudo", value: user.tag, inline: true },
        { name: "ID", value: user.id, inline: true },
        {
          name: "Compte créé le",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "A rejoint le",
          value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "Rôles",
          value:
            member.roles.cache
              .filter((r) => r.id !== interaction.guild.id)
              .map((r) => r.toString())
              .join(", ") || "Aucun",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
