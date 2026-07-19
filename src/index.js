require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { loadCommands } = require("./handlers/commandHandler");
const { loadEvents } = require("./handlers/eventHandler");
const { connectDB, disconnectDB } = require("./db/prisma");
const logger = require("./utils/logger");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

async function start() {
  try {
    logger.info("Bot", "Démarrage du bot RES...");

    await connectDB();
    await loadCommands(client);
    await loadEvents(client);

    await client.login(process.env.TOKEN);
    logger.info("Bot", "Connexion à Discord en cours...");
  } catch (error) {
    logger.error("Bot", "Erreur fatale au démarrage:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  logger.info("Bot", "Arrêt du bot...");
  await disconnectDB();
  client.destroy();
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  logger.error("Bot", "Promise rejetée non gérée:", error);
});

start();
