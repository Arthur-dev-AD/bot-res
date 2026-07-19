const { EmbedBuilder } = require("discord.js");
const { getPrisma } = require("../db/prisma");
const { getConfig } = require("../utils/db");
const { getDefconColor, getDefconInfo, DEFCON_LEVELS } = require("../config/defcon");
const logger = require("./logger");

async function buildDefconEmbed() {
  const prisma = getPrisma();
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("État DEFCON par antenne")
    .setTimestamp();

  if (cities.length > 0) {
    const cityLines = [];
    for (const city of cities) {
      const lvl = Number(city.defcon) || 5;
      const info = getDefconInfo(lvl);
      const count = await prisma.serviceLog.count({
        where: { cityId: city.id, status: "ACTIVE" },
      });
      cityLines.push(
        `${info.emoji} **${city.name}** — DEFCON ${lvl} (${info.name}) — ${count} agent${count !== 1 ? "s" : ""}`
      );
    }
    embed.setDescription(cityLines.join("\n"));
  } else {
    embed.setDescription("Aucune antenne configurée.");
  }

  const legendLines = Object.entries(DEFCON_LEVELS)
    .map(
      ([lvl, info]) =>
        `${info.emoji} **${lvl}.** ${info.name} — ${info.status}\n> ${info.description}`
    )
    .join("\n\n");

  const legendEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Niveaux DEFCON")
    .setDescription(legendLines)
    .setTimestamp();

  return { mainEmbed: embed, legendEmbed };
}

async function updateDefconDisplay(client) {
  const prisma = getPrisma();
  const channelId = await getConfig("DEFCON_DISPLAY_CHANNEL");
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const { mainEmbed, legendEmbed } = await buildDefconEmbed();

  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.length > 0 &&
        m.embeds[0].title?.includes("DEFCON")
    );

    const existing = botMessages.first();
    if (existing) {
      await existing.edit({ embeds: [mainEmbed, legendEmbed] }).catch(() => {});
    } else {
      await channel.send({ embeds: [mainEmbed, legendEmbed] }).catch(() => {});
    }
  } catch (e) {
    logger.error("DefconDisplay", "Erreur mise à jour display:", e);
  }
}

module.exports = { buildDefconEmbed, updateDefconDisplay };
