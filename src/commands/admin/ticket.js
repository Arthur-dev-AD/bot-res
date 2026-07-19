const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const {
  checkDBPermission,
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getCitiesForAutocomplete } = require("../../utils/autocomplete");
const { createTicketChannel } = require("../../utils/ticketUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Système de tickets")
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Ouvrir un ticket")
        .addStringOption((opt) =>
          opt.setName("sujet").setDescription("Sujet du ticket").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("antenne").setDescription("Antenne concernée").setRequired(false).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("priorite")
            .setDescription("Priorité")
            .setRequired(false)
            .addChoices(
              { name: "Basse", value: "LOW" },
              { name: "Normale", value: "NORMAL" },
              { name: "Haute", value: "HIGH" },
              { name: "Urgente", value: "URGENT" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("close").setDescription("Fermer le ticket actuel"))
    .addSubcommand((sub) => sub.setName("claim").setDescription("Prendre en charge le ticket"))
    .addSubcommand((sub) => sub.setName("list").setDescription("Voir les tickets ouverts")),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await getCitiesForAutocomplete(focused);
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MANAGE_TICKETS);
    if (!user) return;

    const prisma = getPrisma();
    const sub = interaction.options.getSubcommand();

    if (sub === "open") {
      const sujet = interaction.options.getString("sujet");
      const antenneStr = interaction.options.getString("antenne");
      const priorite = interaction.options.getString("priorite") || "NORMAL";

      let cityId = null;
      if (antenneStr) {
        const city = await prisma.city.findFirst({
          where: { name: { contains: antenneStr, mode: "insensitive" } },
        });
        if (city) cityId = city.id;
      }

      const { ticketChannel, ticket, ticketNumber } =
        await createTicketChannel(interaction.guild, interaction.user, sujet);

      if (antenneStr && cityId) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { cityId },
        });
      }

      await interaction.reply({
        embeds: [successEmbed("Ticket ouvert", `Ticket #${ticketNumber} créé dans ${ticketChannel}`)],
        ephemeral: true,
      });
    } else if (sub === "close") {
      const ticket = await prisma.ticket.findFirst({
        where: { channelId: interaction.channel.id, status: "OPEN" },
      });

      if (!ticket) {
        return interaction.reply({ embeds: [errorEmbed("Aucun ticket ouvert dans ce salon.")], ephemeral: true });
      }

      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "CLOSED", closedAt: new Date() } });
      await interaction.reply({ embeds: [successEmbed("Ticket fermé", "Ce ticket a été fermé.")] });
      setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
    } else if (sub === "claim") {
      const ticket = await prisma.ticket.findFirst({
        where: { channelId: interaction.channel.id, status: "OPEN" },
      });

      if (!ticket) {
        return interaction.reply({ embeds: [errorEmbed("Aucun ticket ouvert dans ce salon.")], ephemeral: true });
      }

      await prisma.ticket.update({ where: { id: ticket.id }, data: { claimedById: user.id, status: "IN_PROGRESS" } });
      await interaction.reply({
        embeds: [successEmbed("Ticket pris en charge", `**${user.name}** a pris en charge ce ticket.`)],
      });
    } else if (sub === "list") {
      const tickets = await prisma.ticket.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        include: { creator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      });

      if (tickets.length === 0) {
        return interaction.reply({ embeds: [infoEmbed("Tickets", "Aucun ticket ouvert.")], ephemeral: true });
      }

      const list = tickets
        .map((t) => {
          const statusIcon = t.status === "OPEN" ? "🟢" : "🟡";
          return `${statusIcon} **#${t.id.slice(-6)}** | ${t.subject} | Par: ${t.creator.name}`;
        })
        .join("\n");

      await interaction.reply({ embeds: [infoEmbed("Tickets ouverts", list)], ephemeral: true });
    }
  },
};
