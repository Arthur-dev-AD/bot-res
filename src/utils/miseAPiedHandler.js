const { getPrisma } = require("../db/prisma");
const { getExpiredMisesAPied } = require("./db");
const logger = require("./logger");

async function checkExpiredMisesAPied(client) {
  const prisma = getPrisma();
  const expired = await getExpiredMisesAPied();

  for (const mise of expired) {
    await prisma.miseAPied.update({
      where: { id: mise.id },
      data: { isActive: false },
    });

    await prisma.user.update({
      where: { id: mise.user.id },
      data: { status: "ACTIVE" },
    });

    if (mise.addedRoleId && mise.user.discordId) {
      try {
        const guild = client.guilds.cache.first();
        if (!guild) continue;

        const member = await guild.members.fetch(mise.user.discordId);
        if (member) {
          const role = guild.roles.cache.get(mise.addedRoleId);
          if (role) {
            await member.roles.remove(mise.addedRoleId);
            logger.info("MiseAPied", `Rôle ${role.name} retiré de ${mise.user.name} (mise à pied expirée)`);
          }
        }
      } catch (err) {
        logger.error("MiseAPied", `Erreur retrait rôle pour ${mise.user.name}:`, err.message);
      }
    }
  }

  if (expired.length > 0) {
    logger.info("MiseAPied", `${expired.length} mise(s) à pied expirée(s) traitée(s).`);
  }
}

module.exports = { checkExpiredMisesAPied };
