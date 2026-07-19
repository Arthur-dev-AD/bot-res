const logger = require("../utils/logger");
const { updateServiceCounts } = require("./serviceAnnouncement");

module.exports = {
  name: "ready",
  once: true,

  async execute(client) {
    logger.info("Ready", `Connecte en tant que ${client.user.tag}`);
    client.user.setActivity("RES Systems", { type: 3 });

    setTimeout(async () => {
      try {
        await updateServiceCounts(client);
        logger.info("Ready", "Annonces de service initialisées.");
      } catch (error) {
        logger.error("Ready", "Erreur init annonce service:", error.message);
      }
    }, 5000);

    setInterval(async () => {
      try {
        await updateServiceCounts(client);
      } catch (error) {
        logger.error("Ready", "Erreur annonce service:", error.message);
      }
    }, 60000);
  },
};
