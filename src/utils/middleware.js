const { EmbedBuilder } = require("discord.js");
const {
  getUserByDiscordId,
  canPerformAction,
  isUserAbsent,
} = require("../utils/db");
const { hasPermission, PERMISSIONS } = require("../config/permissions");
const { getRoleLabel } = require("../config/roles");

async function checkDBPermission(interaction, requiredPermission) {
  const user = await getUserByDiscordId(interaction.user.id);
  if (!user) {
    await interaction.reply({
      content:
        "❌ Tu n'as pas de compte RES Systems lié. Utilise `/login` pour connecter ton compte.",
      ephemeral: true,
    });
    return null;
  }

  if (user.status === "BLOCKED") {
    await interaction.reply({
      content: "❌ Ton compte est bloqué. Contacte un administrateur.",
      ephemeral: true,
    });
    return null;
  }

  if (!hasPermission(user.role, requiredPermission)) {
    await interaction.reply({
      content: `❌ Tu n'as pas la permission requise. Rôle actuel: **${getRoleLabel(user.role)}**`,
      ephemeral: true,
    });
    return null;
  }

  return user;
}

async function checkNotAbsent(interaction, user) {
  if (await isUserAbsent(user.id)) {
    await interaction.reply({
      content:
        "❌ Tu es actuellement en absence. Impossible d'effectuer cette action.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function checkCanPerformAction(interaction) {
  const result = await canPerformAction(interaction.user.id);
  if (!result.allowed) {
    await interaction.reply({
      content: `❌ ${result.reason}`,
      ephemeral: true,
    });
    return null;
  }

  const user = await getUserByDiscordId(interaction.user.id);
  if (!user) {
    await interaction.reply({
      content:
        "❌ Compte non trouvé. Utilise `/login` pour connecter ton compte.",
      ephemeral: true,
    });
    return null;
  }

  return user;
}

function successEmbed(title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Erreur")
    .setDescription(description)
    .setTimestamp();
}

function infoEmbed(title, description, color = 0x3498db) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  checkDBPermission,
  checkNotAbsent,
  checkCanPerformAction,
  successEmbed,
  errorEmbed,
  infoEmbed,
};
