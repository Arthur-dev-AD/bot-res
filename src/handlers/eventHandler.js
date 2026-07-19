const fs = require("fs");
const path = require("path");

async function loadEvents(client) {
  const eventsDir = path.join(__dirname, "..", "events");
  const eventFiles = fs
    .readdirSync(eventsDir)
    .filter((f) => f.endsWith(".js"));

  for (const file of eventFiles) {
    const event = require(path.join(eventsDir, file));
    if (event.name && event.execute) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }
  }

  console.log(`[Events] ${eventFiles.length} events chargés.`);
}

module.exports = { loadEvents };
