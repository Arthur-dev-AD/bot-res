const { PrismaClient } = require("@prisma/client");

let prisma;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ["error", "warn"],
    });
  }
  return prisma;
}

async function connectDB() {
  try {
    const p = getPrisma();
    await p.$connect();
    console.log("[DB] Connecté à la base de données.");
  } catch (error) {
    console.error("[DB] Erreur de connexion:", error.message);
    process.exit(1);
  }
}

async function disconnectDB() {
  if (prisma) {
    await prisma.$disconnect();
    console.log("[DB] Déconnecté de la base de données.");
  }
}

module.exports = { getPrisma, connectDB, disconnectDB };
