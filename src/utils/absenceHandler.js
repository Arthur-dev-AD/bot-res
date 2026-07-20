const { getPrisma } = require("../db/prisma");
const { getConfig } = require("./db");
const logger = require("./logger");

async function getStartingAbsences() {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.absence.findMany({
    where: {
      cancelled: false,
      removedRoleId: null,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { user: { select: { id: true, discordId: true, name: true } } },
  });
}

async function getExpiredAbsences() {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.absence.findMany({
    where: {
      cancelled: false,
      removedRoleId: { not: null },
      endDate: { lt: now },
    },
    include: { user: { select: { id: true, discordId: true, name: true } } },
  });
}

async function checkAbsences(client) {
  const prisma = getPrisma();

  // 1) Retirer le rôle aux absences qui commencent
  const starting = await getStartingAbsences();
  const absenceRoleId = await getConfig("ABSENCE_ROLE");

  for (const absence of starting) {
    if (!absence.user.discordId || !absenceRoleId) continue;
    try {
      const guild = client.guilds.cache.first();
      if (!guild) continue;

      const member = await guild.members.fetch(absence.user.discordId);
      if (member && member.roles.cache.has(absenceRoleId)) {
        await member.roles.remove(absenceRoleId);
        await prisma.absence.update({
          where: { id: absence.id },
          data: { removedRoleId: absenceRoleId },
        });
        const role = guild.roles.cache.get(absenceRoleId);
        logger.info("Absence", `Rôle ${role ? role.name : absenceRoleId} retiré de ${absence.user.name} (absence commencée)`);
      } else {
        await prisma.absence.update({
          where: { id: absence.id },
          data: { removedRoleId: "NONE" },
        });
      }
    } catch (err) {
      logger.error("Absence", `Erreur retrait rôle pour ${absence.user.name}:`, err.message);
    }
  }

  // 2) Remettre le rôle aux absences expirées
  const expired = await getExpiredAbsences();

  for (const absence of expired) {
    if (absence.removedRoleId && absence.removedRoleId !== "NONE" && absence.user.discordId) {
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

  if (starting.length > 0 || expired.length > 0) {
    logger.info("Absence", `${starting.length} début(s), ${expired.length} fin(s) traité(s).`);
  }
}

module.exports = { checkAbsences };
