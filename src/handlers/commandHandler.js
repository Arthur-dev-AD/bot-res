const fs = require("fs");
const path = require("path");

const commands = new Map();
const commandCategories = [];

async function loadCommands(client) {
  const commandsDir = path.join(__dirname, "..", "commands");
  const categories = fs.readdirSync(commandsDir);

  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(categoryPath)
      .filter((f) => f.endsWith(".js"));

    const categoryCommands = [];

    for (const file of commandFiles) {
      const command = require(path.join(categoryPath, file));
      if (command.data && command.execute) {
        commands.set(command.data.name, command);
        categoryCommands.push(command);
      }
    }

    if (categoryCommands.length > 0) {
      commandCategories.push({ name: category, commands: categoryCommands });
    }
  }

  console.log(`[Commands] ${commands.size} commandes chargées.`);
  return commands;
}

function getCommand(name) {
  return commands.get(name);
}

function getAllCommands() {
  return Array.from(commands.values());
}

function getCommandCategories() {
  return commandCategories;
}

module.exports = {
  loadCommands,
  getCommand,
  getAllCommands,
  getCommandCategories,
};
