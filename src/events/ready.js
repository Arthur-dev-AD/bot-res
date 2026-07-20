const logger = require("../utils/logger");
const { updateServiceCounts } = require("./serviceAnnouncement");
const { checkAbsences } = require("../utils/absenceHandler");
const { checkExpiredMisesAPied } = require("../utils/miseAPiedHandler");

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

    setTimeout(async () => {
      try {
        await checkAbsences(client);
        logger.info("Ready", "Check absences initialisé.");
      } catch (error) {
        logger.error("Ready", "Erreur init check absences:", error.message);
      }
    }, 5000);

    setTimeout(async () => {
      try {
        await checkExpiredMisesAPied(client);
        logger.info("Ready", "Check mises à pied expirées initialisé.");
      } catch (error) {
        logger.error("Ready", "Erreur init check mises à pied:", error.message);
      }
    }, 5000);

    setInterval(async () => {
      try {
        await updateServiceCounts(client);
      } catch (error) {
        logger.error("Ready", "Erreur annonce service:", error.message);
      }
    }, 60000);

    setInterval(async () => {
      try {
        await checkAbsences(client);
      } catch (error) {
        logger.error("Ready", "Erreur check absences:", error.message);
      }
    }, 60000);

    setInterval(async () => {
      try {
        await checkExpiredMisesAPied(client);
      } catch (error) {
        logger.error("Ready", "Erreur check mises à pied:", error.message);
      }
    }, 60000);
  },
};
