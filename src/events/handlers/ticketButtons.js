const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { successEmbed, errorEmbed } = require("../../utils/middleware");
const { createTicketChannel } = require("../../utils/ticketUtils");

async function execute(interaction) {
  const { customId } = interaction;

  if (customId === "ticket_panel_create") {
    const user = await getUserByDiscordId(interaction.user.id);
    if (!user) {
      return interaction.reply({
        content: "❌ Tu n'as pas de compte RES lié. Utilise `/login` pour connecter ton compte.",
        ephemeral: true,
      });
    }

    const prisma = getPrisma();
    const activeTicket = await prisma.ticket.findFirst({
      where: {
        creatorId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });

    if (activeTicket) {
      return interaction.reply({
        content: `❌ Tu as déjà un ticket ouvert : <#${activeTicket.channelId}>`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const { ticketChannel, ticketNumber } = await createTicketChannel(
      interaction.guild,
      interaction.user,
      "Ticket ouvert via panneau"
    );

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Ticket créé",
          `Ton ticket #${ticketNumber} a été créé : ${ticketChannel}`
        ),
      ],
    });
  } else if (customId.startsWith("ticket_claim_")) {
    const ticketId = customId.replace("ticket_claim_", "");
    const prisma = getPrisma();

    const user = await getUserByDiscordId(interaction.user.id);
    if (!user) {
      return interaction.reply({
        content: "❌ Compte non lié.",
        ephemeral: true,
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.status !== "OPEN") {
      return interaction.reply({
        content: "❌ Ce ticket n'est plus disponible.",
        ephemeral: true,
      });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { claimedById: user.id, status: "IN_PROGRESS" },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Ticket pris en charge",
          `**${user.name}** prend en charge ce ticket.`
        ),
      ],
    });
  } else if (customId.startsWith("ticket_close_")) {
    const ticketId = customId.replace("ticket_close_", "");
    const prisma = getPrisma();

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return interaction.reply({
        content: "❌ Ce ticket n'existe plus.",
        ephemeral: true,
      });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    await interaction.reply({
      embeds: [successEmbed("Ticket fermé", "Ce ticket a été fermé.")],
    });

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
}

module.exports = { execute };
