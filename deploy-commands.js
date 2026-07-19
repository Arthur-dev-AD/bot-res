require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsDir = path.join(__dirname, "src", "commands");
const categories = fs.readdirSync(commandsDir);

for (const category of categories) {
  const categoryPath = path.join(commandsDir, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  const commandFiles = fs
    .readdirSync(categoryPath)
    .filter((f) => f.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(categoryPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deploy() {
  try {
    console.log(`Déploiement de ${commands.length} slash commands...`);

    const existing = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
    const existingNames = new Set(existing.map((c) => c.name));
    const newNames = new Set(commands.map((c) => c.name));

    for (const old of existing) {
      if (!newNames.has(old.name)) {
        console.log(`Suppression de l'ancienne commande /${old.name}...`);
        await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, old.id));
      }
    }

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log(`${commands.length} slash commands déployées avec succès.`);
  } catch (error) {
    console.error("Erreur lors du déploiement:", error);
  }
}

deploy();
