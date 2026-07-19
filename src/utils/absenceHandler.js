const { getPrisma } = require("../db/prisma");
const { getExpiredAbsences } = require("./db");
const logger = require("./logger");

async function checkExpiredAbsences(client) {
  const prisma = getPrisma();
  const expired = await getExpiredAbsences();

  for (const absence of expired) {
    await prisma.absence.update({
      where: { id: absence.id },
      data: { isActive: false },
    });

    if (absence.removedRoleId && absence.user.discordId) {
      try {
        const guild = client.guilds.cache.first();
        if (!guild) continue;

        const member = await guild.members.fetch(absence.user.discordId);
        if (member) {
          const role = guild.roles.cache.get(absence.removedRoleId);
          if (role) {
            await member.roles.add(absence.removedRoleId);
            logger.info("Absence", `Rôle ${role.name} remis à ${absence.user.name} (absence expirée)`);
          }
        }
      } catch (err) {
        logger.error("Absence", `Erreur remise rôle pour ${absence.user.name}:`, err.message);
      }
    }
  }

  if (expired.length > 0) {
    logger.info("Absence", `${expired.length} absence(s) expirée(s) traitée(s).`);
  }
}

module.exports = { checkExpiredAbsences };
