const fs = require("fs");
const path = require("path");

const dirs = [
  "commands/general",
  "commands/admin",
  "commands/moderation",
  "commands/service",
  "events",
];

let errors = 0;
let total = 0;

for (const dir of dirs) {
  const p = path.join(__dirname, "src", dir);
  if (!fs.existsSync(p)) continue;
  const files = fs.readdirSync(p).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    total++;
    try {
      require(path.join(p, f));
      console.log("OK " + dir + "/" + f);
    } catch (e) {
      console.log("ERR " + dir + "/" + f + ": " + e.message);
      errors++;
    }
  }
}

console.log("\n" + total + " fichiers, " + errors + " erreur(s)");
process.exit(errors > 0 ? 1 : 0);
