const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { getPrisma } = require("../db/prisma");
const { getUserByDiscordId, getConfig } = require("./db");

async function createTicketChannel(guild, interactionUser, subject) {
  const prisma = getPrisma();
  const ticketCount = await prisma.ticket.count();
  const ticketNumber = ticketCount + 1;
  const channelName = `ticket-${ticketNumber}-${subject
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 30)}`;

  const ticketsCategoryId = await getConfig("DISCORD_TICKETS_CATEGORY");
  const parent = ticketsCategoryId
    ? guild.channels.cache.get(ticketsCategoryId)
    : null;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parent?.id || undefined,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interactionUser.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const user = await getUserByDiscordId(interactionUser.id);

  const ticket = await prisma.ticket.create({
    data: {
      channelId: ticketChannel.id,
      creatorId: user?.id || interactionUser.id,
      subject,
      priority: "NORMAL",
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`Ticket #${ticketNumber}`)
    .setDescription(
      [
        `🎫 **${subject}**`,
        `**Créé par :** ${interactionUser.tag}`,
        `**Priorité :** Normale`,
        "",
        "Un agent va prendre en charge ce ticket.\nUtilisez les boutons ci-dessous pour gérer le ticket.",
      ].join("\n")
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticket.id}`)
      .setLabel("Prendre en charge")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👋"),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticket.id}`)
      .setLabel("Fermer")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );

  await ticketChannel.send({ embeds: [embed], components: [row] });

  return { ticketChannel, ticket, ticketNumber };
}

module.exports = { createTicketChannel };
