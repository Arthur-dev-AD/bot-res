const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const crypto = require("crypto");
const { getUserByDiscordId } = require("../../utils/db");
const { successEmbed } = require("../../utils/middleware");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Connecte ton compte RES Systems au bot Discord"),

  async execute(interaction) {
    const existing = await getUserByDiscordId(interaction.user.id);
    if (existing) {
      return interaction.reply({
        embeds: [
          successEmbed(
            "Déjà connecté",
            `Ton compte est déjà lié : **${existing.name}** (${existing.role})`
          ),
        ],
        ephemeral: true,
      });
    }

    const code = crypto.randomBytes(16).toString("hex");
    const siteUrl = process.env.SITE_URL || "http://localhost:3333";

    try {
      const res = await fetch(`${siteUrl}/api/oauth/pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discordId: interaction.user.id,
          discordTag: interaction.user.tag,
        }),
      });

      if (!res.ok) {
        return interaction.reply({
          embeds: [successEmbed("Erreur", "Impossible de contacter le site RES. Réessayez plus tard.")],
          ephemeral: true,
        });
      }
    } catch (e) {
      return interaction.reply({
        embeds: [
          successEmbed(
            "Site inaccessible",
            `Le site RES n'est pas joignable à **${siteUrl}**. Vérifie que le serveur est en ligne.`
          ),
        ],
        ephemeral: true,
      });
    }

    const authUrl = `${siteUrl}/oauth/bot/link?code=${code}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Se connecter sur le site")
        .setURL(authUrl)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.reply({
      embeds: [
        successEmbed(
          "Lien Discord → RES Systems",
          [
            "**Étape 1 :** Clique sur le bouton ci-dessous pour ouvrir le site.",
            "**Étape 2 :** Connecte-toi avec tes identifiants RES.",
            "**Étape 3 :** Le lien sera fait automatiquement.",
            "",
            "⏱️ Ce lien expire dans **5 minutes**.",
            "",
            `\`Code: ${code}\``,
          ].join("\n")
        ),
      ],
      components: [row],
      ephemeral: true,
    });
  },
};
