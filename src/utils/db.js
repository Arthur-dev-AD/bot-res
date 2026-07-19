const { getPrisma } = require("../db/prisma");

async function getUserByDiscordId(discordId) {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { discordId } });
}

async function linkDiscordAccount(userId, discordId) {
  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: userId },
    data: { discordId },
  });
}

async function getUserRole(discordId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { discordId },
    select: { role: true, status: true },
  });
  return user;
}

async function isUserActive(discordId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { discordId },
    select: { status: true },
  });
  return user?.status === "ACTIVE";
}

async function isUserAbsent(userId) {
  const prisma = getPrisma();
  const now = new Date();
  const absence = await prisma.absence.findFirst({
    where: {
      userId,
      isActive: true,
      cancelled: false,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  return !!absence;
}

async function isUserMiseAPied(discordId) {
  const prisma = getPrisma();
  const now = new Date();
  const mise = await prisma.miseAPied.findFirst({
    where: {
      user: { discordId },
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  return !!mise;
}

async function canPerformAction(userId) {
  const user = await getUserRole(userId);
  if (!user) return { allowed: false, reason: "Compte non trouvé." };
  if (user.status === "BLOCKED")
    return { allowed: false, reason: "Ton compte est bloqué." };
  if (await isUserMiseAPied(userId))
    return {
      allowed: false,
      reason: "Tu es actuellement en mise à pied.",
    };
  return { allowed: true };
}

async function getActiveServiceCount(cityId = null) {
  const prisma = getPrisma();
  const where = { status: "ACTIVE" };
  if (cityId) where.cityId = cityId;
  return prisma.serviceLog.count({ where });
}

async function getActiveServices(cityId = null) {
  const prisma = getPrisma();
  const where = { status: "ACTIVE" };
  if (cityId) where.cityId = cityId;
  return prisma.serviceLog.findMany({
    where,
    include: { agent: { select: { name: true, role: true } } },
  });
}

async function getCities() {
  const prisma = getPrisma();
  return prisma.city.findMany({ orderBy: { name: "asc" } });
}

async function getCityByName(name) {
  const prisma = getPrisma();
  return prisma.city.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
  });
}

async function getConfig(key) {
  const prisma = getPrisma();
  const config = await prisma.config.findUnique({ where: { key } });
  return config?.value;
}

async function setConfig(key, value) {
  const prisma = getPrisma();
  return prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getExpiredAbsences() {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.absence.findMany({
    where: {
      isActive: true,
      cancelled: false,
      endDate: { lt: now },
    },
    include: { user: { select: { id: true, discordId: true, name: true } } },
  });
}

module.exports = {
  getUserByDiscordId,
  linkDiscordAccount,
  getUserRole,
  isUserActive,
  isUserAbsent,
  isUserMiseAPied,
  canPerformAction,
  getActiveServiceCount,
  getActiveServices,
  getCities,
  getCityByName,
  getConfig,
  setConfig,
  getExpiredAbsences,
};
