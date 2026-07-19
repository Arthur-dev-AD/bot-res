const { getCommand } = require("../handlers/commandHandler");
const ticketHandler = require("./handlers/ticketButtons");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = getCommand(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(
          `[Command] Erreur dans /${interaction.commandName}:`,
          error
        );
        const reply = {
          content: "Une erreur est survenue lors de l'exécution de la commande.",
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    } else if (interaction.isAutocomplete()) {
      const command = getCommand(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`[Autocomplete] Erreur:`, error);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === "setup_antenne_modal_submit") {
        try {
          const { getPrisma } = require("../db/prisma");
          const prisma = getPrisma();
          const { handleAntenneModalSubmit } = require("../commands/admin/setup-res");
          await handleAntenneModalSubmit(interaction, prisma);
        } catch (error) {
          console.error("[Modal] Erreur:", error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Une erreur est survenue.",
              ephemeral: true,
            });
          }
        }
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("antlink_")) {
        try {
          const { getPrisma } = require("../db/prisma");
          const prisma = getPrisma();
          const { handleAntenneLink } = require("../commands/admin/setup-res");
          await handleAntenneLink(interaction, prisma, interaction.customId.replace("antlink_", ""));
        } catch (error) {
          console.error("[Select] Erreur:", error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Une erreur est survenue.", ephemeral: true });
          }
        }
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("ticket_")) {
        try {
          await ticketHandler.execute(interaction);
        } catch (error) {
          console.error("[Button] Erreur:", error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Une erreur est survenue.",
              ephemeral: true,
            });
          }
        }
      }
    }
  },
};
