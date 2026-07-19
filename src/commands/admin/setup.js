const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  checkDBPermission,
  successEmbed,
  errorEmbed,
} = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getConfig, setConfig } = require("../../utils/db");
const { ROLES } = require("../../config/roles");
const { DEFCON_LEVELS, getDefconInfo } = require("../../config/defcon");
const { updateDefconDisplay } = require("../../utils/defconDisplay");

const SETUP_TIMEOUT = 180000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configuration interactive du bot RES Systems")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MANAGE_BOT);
    if (!user) return;

    const prisma = getPrisma();
    const reply = await interaction.reply({
      embeds: [await buildMainEmbed(prisma)],
      components: buildMainButtons(),
      ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({
      time: SETUP_TIMEOUT,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "Ce menu ne t'est pas destiné.", ephemeral: true });
      }

      const id = i.customId;

      if (id === "setup_roles") {
        await handleRoles(i, prisma);
      } else if (id === "setup_channels") {
        await handleChannels(i);
      } else if (id === "setup_antenne") {
        await handleAntenne(i, prisma);
      } else if (id === "setup_defcon") {
        await handleDefcon(i, prisma);
      } else if (id === "setup_tickets") {
        await handleTickets(i, prisma);
      } else if (id === "setup_absence") {
        await handleAbsenceConfig(i);
      } else if (id === "setup_status") {
        await handleStatus(i, prisma);
      } else if (id === "setup_back") {
        await handleBack(i, prisma);
      } else if (id.startsWith("setrole_")) {
        await handleSetRole(i, prisma, id.replace("setrole_", ""));
      } else if (id.startsWith("antlink_")) {
        await handleAntenneLink(i, prisma, id.replace("antlink_", ""));
      } else if (id === "setup_antenne_modal") {
        await handleAntenneModal(i);
      } else if (id === "setup_defcon_channel") {
        await handleDefconChannelSelect(i);
      } else if (id.startsWith("setup_defcon_set_")) {
        await handleDefconChannelSet(i, id.replace("setup_defcon_set_", ""));
      } else if (id === "setup_ticket_panel_channel") {
        await handleTicketPanelChannelSelect(i);
      } else if (id.startsWith("setup_ticket_panel_set_")) {
        await handleTicketPanelSet(i, prisma, id.replace("setup_ticket_panel_set_", ""));
      }
    });

    collector.on("end", async () => {
      try { await interaction.editReply({ components: [] }); } catch {}
    });
  },
};

function buildMainButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_roles").setLabel("Rôles").setStyle(ButtonStyle.Primary).setEmoji("🎭"),
    new ButtonBuilder().setCustomId("setup_channels").setLabel("Salons").setStyle(ButtonStyle.Primary).setEmoji("📢"),
    new ButtonBuilder().setCustomId("setup_antenne").setLabel("Antenne").setStyle(ButtonStyle.Primary).setEmoji("🏢"),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_defcon").setLabel("DEFCON").setStyle(ButtonStyle.Primary).setEmoji("🔴"),
    new ButtonBuilder().setCustomId("setup_tickets").setLabel("Tickets").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
    new ButtonBuilder().setCustomId("setup_absence").setLabel("Absence").setStyle(ButtonStyle.Primary).setEmoji("🟢"),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_status").setLabel("Status").setStyle(ButtonStyle.Secondary).setEmoji("📊"),
  );
  return [row1, row2, row3];
}

async function buildMainEmbed(prisma) {
  const allConfigs = await prisma.config.findMany({ where: { key: { startsWith: "DISCORD_ROLE_" } } });
  const roleMap = {};
  for (const e of allConfigs) roleMap[e.key.replace("DISCORD_ROLE_", "")] = e.value;

  const serviceChannelId = await getConfig("DISCORD_SERVICE_CHANNEL");
  const ticketsCategoryId = await getConfig("DISCORD_TICKETS_CATEGORY");
  const defconDisplayId = await getConfig("DEFCON_DISPLAY_CHANNEL");
  const ticketPanelId = await getConfig("TICKET_PANEL_CHANNEL");
  const absenceRoleId = await getConfig("ABSENCE_ROLE");
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  const defconSummary = cities.length > 0
    ? cities.map((c) => {
        const lvl = Number(c.defcon) || 5;
        const i = getDefconInfo(lvl);
        return `${i.emoji} ${c.name}: ${lvl}`;
      }).join(" | ")
    : "Aucune antenne";

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Setup RES Bot")
    .setDescription("Tout est configurable depuis ici. Choisissez une section.")
    .addFields(
      { name: "🎭 Rôles", value: `${Object.keys(roleMap).length}/${Object.keys(ROLES).length} mappés`, inline: true },
      { name: "📢 Salon Service", value: serviceChannelId ? `<#${serviceChannelId}>` : "❌", inline: true },
      { name: "🎫 Cat. Tickets", value: ticketsCategoryId ? `<#${ticketsCategoryId}>` : "❌", inline: true },
      { name: "📺 Affichage DEFCON", value: defconDisplayId ? `<#${defconDisplayId}>` : "❌", inline: true },
      { name: "🎫 Panneau Tickets", value: ticketPanelId ? `<#${ticketPanelId}>` : "❌", inline: true },
      { name: "🟢 Rôle Absence", value: absenceRoleId ? `<@&${absenceRoleId}>` : "❌", inline: true },
      { name: "🔴 DEFCON", value: defconSummary, inline: false },
    )
    .setTimestamp();
}

async function handleBack(interaction, prisma) {
  await interaction.update({ embeds: [await buildMainEmbed(prisma)], components: buildMainButtons() });
}

async function handleRoles(interaction, prisma) {
  const entries = await prisma.config.findMany({ where: { key: { startsWith: "DISCORD_ROLE_" } } });
  const roleMap = {};
  for (const e of entries) roleMap[e.key.replace("DISCORD_ROLE_", "")] = e.value;

  const fields = Object.values(ROLES).map((r) => ({
    name: `${r.label} (${r.category})`,
    value: roleMap[r.id] ? `<@&${roleMap[r.id]}>` : "❌ Non configuré",
    inline: true,
  }));

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Configuration des rôles")
    .setDescription("Sélectionnez un rôle RES pour le mapper à un rôle Discord.")
    .addFields(fields)
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId("setup_role_select")
    .setPlaceholder("Choisir un rôle RES à mapper")
    .addOptions(Object.values(ROLES).map((r) => ({ label: r.label, value: r.id, description: `${r.category} — Nv. ${r.level}` })));

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary)),
    ],
  });

  const c = interaction.message.createMessageComponentCollector({ time: SETUP_TIMEOUT, filter: (m) => m.customId === "setup_role_select" && m.user.id === interaction.user.id });
  c.on("collect", async (i) => await handleSetRoleFromSelect(i, prisma, i.values[0]));
}

async function handleSetRoleFromSelect(interaction, prisma, resRole) {
  const guild = interaction.guild;
  const roles = guild.roles.cache.filter((r) => r.id !== guild.id).sort((a, b) => b.position - a.position).map((r) => ({ label: r.name, value: r.id }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`setrole_${resRole}`)
    .setPlaceholder(`Rôle Discord pour ${ROLES[resRole]?.label || resRole}`)
    .addOptions(roles.slice(0, 25));

  await interaction.update({
    content: `Mapper **${ROLES[resRole]?.label || resRole}** vers un rôle Discord :`,
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_roles").setLabel("Retour").setStyle(ButtonStyle.Secondary)),
    ],
    embeds: [],
  });
}

async function handleSetRole(interaction, prisma, resRole) {
  const discordRoleId = interaction.values[0];
  await setConfig(`DISCORD_ROLE_${resRole}`, discordRoleId);
  await interaction.update({ content: `✅ **${ROLES[resRole]?.label || resRole}** mappé à <@&${discordRoleId}>`, components: [], embeds: [] });
}

async function handleChannels(interaction) {
  const serviceChannelId = await getConfig("DISCORD_SERVICE_CHANNEL");
  const ticketsCategoryId = await getConfig("DISCORD_TICKETS_CATEGORY");

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Configuration des salons")
    .setDescription(
      `**Salon service :** ${serviceChannelId ? `<#${serviceChannelId}>` : "❌"}\n` +
      `**Catégorie tickets :** ${ticketsCategoryId ? `<#${ticketsCategoryId}>` : "❌"}`
    );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("setup_channel_select")
      .setPlaceholder("Choisir le type de salon")
      .addOptions(
        { label: "Salon Service", value: "service", description: "Annonces de service" },
        { label: "Catégorie Tickets", value: "tickets", description: "Catégorie pour les tickets" }
      )
  );

  await interaction.update({
    embeds: [embed],
    components: [row, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary))],
  });

  const c = interaction.message.createMessageComponentCollector({ time: SETUP_TIMEOUT, filter: (m) => m.customId === "setup_channel_select" && m.user.id === interaction.user.id });
  c.on("collect", async (i) => {
    const type = i.values[0];
    const channelType = type === "tickets" ? ChannelType.GuildCategory : ChannelType.GuildText;
    const channels = i.guild.channels.cache.filter((c) => c.type === channelType).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.id }));

    if (!channels.length) return i.update({ content: `Aucun ${type === "tickets" ? "catégorie" : "salon"} disponible.`, components: [], embeds: [] });

    const sel = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`setup_chosen_${type}`).setPlaceholder(`Sélectionner ${type === "tickets" ? "la catégorie" : "le salon"}`).addOptions(channels.slice(0, 25))
    );
    await i.update({ content: `Sélectionnez ${type === "tickets" ? "la catégorie" : "le salon"} :`, components: [sel, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_channels").setLabel("Retour").setStyle(ButtonStyle.Secondary))], embeds: [] });

    const c2 = i.message.createMessageComponentCollector({ time: SETUP_TIMEOUT, filter: (m) => m.customId === `setup_chosen_${type}` && m.user.id === i.user.id });
    c2.on("collect", async (j) => {
      const channelId = j.values[0];
      await setConfig(type === "service" ? "DISCORD_SERVICE_CHANNEL" : "DISCORD_TICKETS_CATEGORY", channelId);
      await j.update({ content: `✅ Configuré : <#${channelId}>`, components: [], embeds: [] });
    });
  });
}

async function handleAntenne(interaction, prisma) {
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Configuration des antennes")
    .setDescription(
      "Entrez l'**ID de la ville** depuis le site/app desktop pour la lier à un salon Discord.\n\n" +
      (cities.length > 0
        ? "Antennes :\n" + cities.map((c) => `• **${c.name}** (\`${c.id}\`) — ${c.channelId ? `<#${c.channelId}>` : "❌"}`).join("\n")
        : "Aucune antenne configurée.")
    );

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_antenne_modal").setLabel("Entrer un ID de ville").setStyle(ButtonStyle.Success).setEmoji("🔍"),
        new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

async function handleAntenneModal(interaction) {
  const modal = new ModalBuilder().setCustomId("setup_antenne_modal_submit").setTitle("Lier une antenne");
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId("city_id").setLabel("ID de la ville (copié depuis le site)").setPlaceholder("ex: clxyz123abc...").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(5).setMaxLength(50)
  ));
  await interaction.showModal(modal);
}

async function handleAntenneModalSubmit(interaction, prisma) {
  const cityId = interaction.fields.getTextInputValue("city_id").trim();
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return interaction.reply({ content: `❌ Aucune ville trouvée avec l'ID \`${cityId}\`.`, ephemeral: true });

  const channels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.id }));
  if (!channels.length) return interaction.reply({ content: "❌ Aucun salon texte disponible.", ephemeral: true });

  await interaction.reply({
    content: `Lier **${city.name}** à un salon :`,
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`antlink_${city.id}`).setPlaceholder(`Salon pour ${city.name}`).addOptions(channels.slice(0, 25)))],
    ephemeral: true,
  });
}

async function handleAntenneLink(interaction, prisma, cityId) {
  const channelId = interaction.values[0];
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return;
  await prisma.city.update({ where: { id: cityId }, data: { channelId } });
  await interaction.update({ content: `✅ **${city.name}** liée à <#${channelId}>`, components: [], embeds: [] });
}

async function handleDefcon(interaction, prisma) {
  const defconDisplayId = await getConfig("DEFCON_DISPLAY_CHANNEL");

  const cityDefs = await prisma.city.findMany({ orderBy: { name: "asc" } });
  const cityLines = cityDefs.length > 0
    ? cityDefs.map((c) => {
        const lvl = Number(c.defcon) || 5;
        const ci = getDefconInfo(lvl);
        return `${ci.emoji} **${c.name}** — DEFCON ${lvl} (${ci.name})`;
      }).join("\n")
    : "Aucune antenne";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Configuration DEFCON")
    .setDescription(
      `**Affichage :** ${defconDisplayId ? `<#${defconDisplayId}>` : "❌ Non configuré"}\n\n` +
      `**Par antenne :**\n${cityLines}`
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_defcon_channel").setLabel("Salon d'affichage").setStyle(ButtonStyle.Primary).setEmoji("📺"),
        new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

async function handleDefconChannelSelect(interaction) {
  const channels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.id }));

  await interaction.update({
    content: "Sélectionnez le salon pour l'affichage DEFCON :",
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("setup_defcon_channel_pick").setPlaceholder("Salon DEFCON").addOptions(channels.slice(0, 25))),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_defcon").setLabel("Retour").setStyle(ButtonStyle.Secondary)),
    ],
    embeds: [],
  });

  const c = interaction.message.createMessageComponentCollector({ time: SETUP_TIMEOUT, filter: (m) => m.customId === "setup_defcon_channel_pick" && m.user.id === interaction.user.id });
  c.on("collect", async (i) => await handleDefconChannelSet(i, i.values[0]));
}

async function handleDefconChannelSet(interaction, channelId) {
  await setConfig("DEFCON_DISPLAY_CHANNEL", channelId);
  await interaction.update({ content: `✅ Affichage DEFCON configuré dans <#${channelId}>`, components: [], embeds: [] });
  try { await updateDefconDisplay(interaction.client); } catch {}
}

async function handleTickets(interaction, prisma) {
  const ticketsCategoryId = await getConfig("DISCORD_TICKETS_CATEGORY");
  const ticketPanelId = await getConfig("TICKET_PANEL_CHANNEL");

  const openTickets = await prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } });
  const totalTickets = await prisma.ticket.count();

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Configuration Tickets")
    .setDescription(
      `**Catégorie :** ${ticketsCategoryId ? `<#${ticketsCategoryId}>` : "❌"}\n` +
      `**Panneau :** ${ticketPanelId ? `<#${ticketPanelId}>` : "❌ Non configuré"}\n\n` +
      `**Stats :** ${openTickets} ticket(s) ouvert(s) / ${totalTickets} total`
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_ticket_panel_channel").setLabel("Panneau de tickets").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
        new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

async function handleTicketPanelChannelSelect(interaction) {
  const channels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.id }));

  await interaction.update({
    content: "Sélectionnez le salon pour le panneau de tickets :",
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("setup_ticket_panel_pick").setPlaceholder("Salon panneau").addOptions(channels.slice(0, 25))),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_tickets").setLabel("Retour").setStyle(ButtonStyle.Secondary)),
    ],
    embeds: [],
  });

  const c = interaction.message.createMessageComponentCollector({ time: SETUP_TIMEOUT, filter: (m) => m.customId === "setup_ticket_panel_pick" && m.user.id === interaction.user.id });
  c.on("collect", async (i) => await handleTicketPanelSet(i, null, i.values[0]));
}

async function handleTicketPanelSet(interaction, prisma, channelId) {
  const guild = interaction.guild;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return interaction.update({ content: "❌ Salon introuvable.", components: [], embeds: [] });

  const panelEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Support RES Systems")
    .setDescription("Besoin d'aide ? Cliquez sur le bouton ci-dessous pour ouvrir un ticket.\nUn agent vous répondra dès que possible.")
    .setFooter({ text: "RES Systems — Support" })
    .setTimestamp();

  const panelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_panel_create").setLabel("Créer un ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
  );

  const msg = await channel.send({ embeds: [panelEmbed], components: [panelRow] }).catch(() => null);
  if (!msg) return interaction.update({ content: "❌ Impossible d'envoyer le panneau dans ce salon.", components: [], embeds: [] });

  await setConfig("TICKET_PANEL_CHANNEL", channelId);
  await setConfig("TICKET_PANEL_MESSAGE", msg.id);

  await interaction.update({ content: `✅ Panneau de tickets envoyé dans ${channel}`, components: [], embeds: [] });
}

async function handleAbsenceConfig(interaction) {
  const absenceRoleId = await getConfig("ABSENCE_ROLE");

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Configuration Absence")
    .setDescription(
      `Configurez le rôle Discord qui sera **retiré** lors d'une absence et **remis** à la fin.\n\n` +
      `**Rôle d'absence actuel :** ${absenceRoleId ? `<@&${absenceRoleId}>` : "❌ Non configuré"}`
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_absence_role").setLabel("Choisir le rôle").setStyle(ButtonStyle.Primary).setEmoji("🎭"),
        new ButtonBuilder().setCustomId("setup_absence_clear").setLabel("Supprimer").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
        new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary),
      ),
    ],
  });

  const c = interaction.message.createMessageComponentCollector({
    time: SETUP_TIMEOUT,
    filter: (m) => (m.customId === "setup_absence_role" || m.customId === "setup_absence_clear") && m.user.id === interaction.user.id,
  });

  c.on("collect", async (i) => {
    if (i.customId === "setup_absence_clear") {
      const prisma = getPrisma();
      await setConfig("ABSENCE_ROLE", "");
      await handleBack(i, prisma);
      return;
    }

    const guild = i.guild;
    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ label: r.name, value: r.id }));

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_absence_role_pick")
      .setPlaceholder("Rôle à retirer pendant l'absence")
      .addOptions(roles.slice(0, 25));

    await i.update({
      content: "Sélectionnez le rôle à retirer lors d'une absence :",
      components: [
        new ActionRowBuilder().addComponents(select),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_absence").setLabel("Retour").setStyle(ButtonStyle.Secondary)),
      ],
      embeds: [],
    });

    const c2 = i.message.createMessageComponentCollector({
      time: SETUP_TIMEOUT,
      filter: (m) => m.customId === "setup_absence_role_pick" && m.user.id === i.user.id,
    });

    c2.on("collect", async (j) => {
      const roleId = j.values[0];
      await setConfig("ABSENCE_ROLE", roleId);
      await j.update({ content: `✅ Rôle d'absence configuré : <@&${roleId}>`, components: [], embeds: [] });
    });
  });
}

async function handleStatus(interaction, prisma) {
  const allConfigs = await prisma.config.findMany({ where: { key: { startsWith: "DISCORD_ROLE_" } } });
  const roleMap = {};
  for (const e of allConfigs) roleMap[e.key.replace("DISCORD_ROLE_", "")] = e.value;

  const serviceChannelId = await getConfig("DISCORD_SERVICE_CHANNEL");
  const ticketsCategoryId = await getConfig("DISCORD_TICKETS_CATEGORY");
  const defconDisplayId = await getConfig("DEFCON_DISPLAY_CHANNEL");
  const ticketPanelId = await getConfig("TICKET_PANEL_CHANNEL");
  const absenceRoleId = await getConfig("ABSENCE_ROLE");
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  const roleFields = Object.values(ROLES).map((r) => ({
    name: r.label, value: roleMap[r.id] ? `<@&${roleMap[r.id]}>` : "❌", inline: true,
  }));

  const cityList = cities.length > 0
    ? cities.map((c) => `**${c.name}** → ${c.channelId ? `<#${c.channelId}>` : "❌"} | DEFCON ${c.defcon}`).join("\n")
    : "Aucune antenne";

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Status complet")
    .addFields(roleFields.length > 0 ? roleFields : [{ name: "Rôles", value: "Aucun rôle mappé", inline: true }])
    .setDescription(cityList)
    .addFields(
      { name: "Salon Service", value: serviceChannelId ? `<#${serviceChannelId}>` : "❌", inline: true },
      { name: "Cat. Tickets", value: ticketsCategoryId ? `<#${ticketsCategoryId}>` : "❌", inline: true },
      { name: "Affichage DEFCON", value: defconDisplayId ? `<#${defconDisplayId}>` : "❌", inline: true },
      { name: "Panneau Tickets", value: ticketPanelId ? `<#${ticketPanelId}>` : "❌", inline: true },
      { name: "Rôle Absence", value: absenceRoleId ? `<@&${absenceRoleId}>` : "❌", inline: true },
    )
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("setup_back").setLabel("Retour").setStyle(ButtonStyle.Secondary))] });
}

module.exports.handleAntenneModalSubmit = handleAntenneModalSubmit;
