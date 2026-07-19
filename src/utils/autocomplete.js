const { getPrisma } = require("../db/prisma");

async function getCitiesForAutocomplete(focusedValue) {
  const prisma = getPrisma();
  try {
    const cities = await prisma.city.findMany({
      where: focusedValue
        ? { name: { contains: focusedValue, mode: "insensitive" } }
        : {},
      orderBy: { name: "asc" },
      take: 25,
    });
    return cities.map((c) => ({
      name: `${c.name} (DEFCON ${c.defcon})`,
      value: c.name,
    }));
  } catch {
    return [];
  }
}

async function getUsersForAutocomplete(focusedValue) {
  const prisma = getPrisma();
  try {
    const users = await prisma.user.findMany({
      where: focusedValue
        ? {
            OR: [
              { name: { contains: focusedValue, mode: "insensitive" } },
              { email: { contains: focusedValue, mode: "insensitive" } },
            ],
          }
        : {},
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: 25,
    });
    return users.map((u) => ({
      name: `${u.name || u.email} (${u.role})`,
      value: u.id,
    }));
  } catch {
    return [];
  }
}

module.exports = { getCitiesForAutocomplete, getUsersForAutocomplete };
