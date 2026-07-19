const { EmbedBuilder } = require("discord.js");
const { getPrisma } = require("../db/prisma");
const logger = require("../utils/logger");

async function updateServiceCounts(client) {
  const prisma = getPrisma();

  const cities = await prisma.city.findMany({
    where: { channelId: { not: null } },
  });

  for (const city of cities) {
    const activeCount = await prisma.serviceLog.count({
      where: {
        cityId: city.id,
        status: "ACTIVE",
      },
    });

    const channel = client.channels.cache.get(city.channelId);
    if (!channel) continue;

    const embed = new EmbedBuilder()
      .setColor(activeCount > 0 ? 0x2ecc71 : 0x95a5a6)
      .setTitle(`🏢 ${city.name}`)
      .setDescription(
        activeCount > 0
          ? `🟢 **${activeCount}** agent(s) en service`
          : "🔴 Aucun agent en service"
      )
      .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(
      (m) => m.author.id === client.user.id && m.embeds.length > 0
    );

    if (botMessage) {
      await botMessage.edit({ embeds: [embed] }).catch(() => {});
    } else {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

module.exports = { updateServiceCounts };
