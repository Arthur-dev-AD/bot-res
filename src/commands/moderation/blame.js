const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const {
  checkDBPermission,
  successEmbed,
  errorEmbed,
  infoEmbed,
} = require("../../utils/middleware");
const { PERMISSIONS } = require("../../config/permissions");
const { getPrisma } = require("../../db/prisma");
const { getUserByDiscordId } = require("../../utils/db");
const { formatDiscordTimestamp } = require("../../utils/dates");

const SEVERITY_EMOJI = { INFO: "ℹ️", WARNING: "⚠️", CRITICAL: "🔴" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blame")
    .setDescription("Modération interne - Gestion des blames")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Mettre un blame à un agent")
        .addUserOption((opt) =>
          opt.setName("agent").setDescription("L'agent à blamer").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("raison").setDescription("Raison du blame").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("severite")
            .setDescription("Sévérité")
            .setRequired(false)
            .addChoices(
              { name: "Information", value: "INFO" },
              { name: "Avertissement", value: "WARNING" },
              { name: "Critique", value: "CRITICAL" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("notes").setDescription("Notes supplémentaires").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Voir les blames d'un agent")
        .addUserOption((opt) =>
          opt.setName("agent").setDescription("Agent à consulter").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer un blame d'un agent")
        .addUserOption((opt) =>
          opt.setName("agent").setDescription("L'agent concerné").setRequired(true)
        )
    ),

  async execute(interaction) {
    const user = await checkDBPermission(interaction, PERMISSIONS.MODERATE_INTERNAL);
    if (!user) return;

    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      await handleAdd(interaction, user);
    } else if (sub === "list") {
      await handleList(interaction);
    } else if (sub === "remove") {
      await handleRemoveStart(interaction);
    }
  },
};

async function handleAdd(interaction, user) {
  const targetMember = interaction.options.getUser("agent");
  const raison = interaction.options.getString("raison");
  const severite = interaction.options.getString("severite") || "WARNING";
  const notes = interaction.options.getString("notes");

  const targetUser = await getUserByDiscordId(targetMember.id);
  if (!targetUser) {
    return interaction.reply({
      embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
      ephemeral: true,
    });
  }

  const prisma = getPrisma();
  await prisma.blame.create({
    data: {
      userId: targetUser.id,
      authorId: user.id,
      reason: raison,
      severity: severite,
      notes,
    },
  });

  const blameCount = await prisma.blame.count({
    where: { userId: targetUser.id },
  });

  await interaction.reply({
    embeds: [
      successEmbed(
        "Blame enregistré",
        [
          `${SEVERITY_EMOJI[severite] || "⚠️"} **Blame #${blameCount}** pour **${targetUser.name}**`,
          `**Raison :** ${raison}`,
          `**Sévérité :** ${severite}`,
          notes ? `**Notes :** ${notes}` : null,
          `**Par :** ${user.name}`,
        ]
          .filter(Boolean)
          .join("\n")
      ),
    ],
  });
}

async function handleList(interaction) {
  const targetMember = interaction.options.getUser("agent");
  const targetUser = await getUserByDiscordId(targetMember.id);
  if (!targetUser) {
    return interaction.reply({
      embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
      ephemeral: true,
    });
  }

  const prisma = getPrisma();
  const blames = await prisma.blame.findMany({
    where: { userId: targetUser.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (blames.length === 0) {
    return interaction.reply({
      embeds: [infoEmbed("Blames", `${targetUser.name} n'a aucun blame.`)],
      ephemeral: true,
    });
  }

  const list = blames
    .map(
      (b, i) =>
        `${SEVERITY_EMOJI[b.severity] || "⚠️"} **#${i + 1}** — ${b.reason} | Par: ${b.author.name} | ${formatDiscordTimestamp(b.createdAt, "d")}`
    )
    .join("\n");

  await interaction.reply({
    embeds: [infoEmbed(`Blames de ${targetUser.name} (${blames.length})`, list)],
    ephemeral: true,
  });
}

async function handleRemoveStart(interaction) {
  const targetMember = interaction.options.getUser("agent");
  const targetUser = await getUserByDiscordId(targetMember.id);
  if (!targetUser) {
    return interaction.reply({
      embeds: [errorEmbed("Cet agent n'a pas de compte RES Systems lié.")],
      ephemeral: true,
    });
  }

  const prisma = getPrisma();
  const blames = await prisma.blame.findMany({
    where: { userId: targetUser.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  if (blames.length === 0) {
    return interaction.reply({
      embeds: [infoEmbed("Blames", `${targetUser.name} n'a aucun blame à retirer.`)],
      ephemeral: true,
    });
  }

  const options = blames.map((b, i) => ({
    label: `#${i + 1} — ${b.reason.slice(0, 80)}`,
    value: b.id,
    description: `${SEVERITY_EMOJI[b.severity] || "⚠️"} ${b.severity} | Par: ${b.author.name}`,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`blame_remove_select_${targetUser.id}`)
    .setPlaceholder(`Choisir un blame à retirer (${blames.length} total)`)
    .addOptions(options);

  await interaction.reply({
    content: `Sélectionnez le blame à retirer pour **${targetUser.name}** :`,
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });

  const collector = interaction.channel.createMessageComponentCollector({
    time: 60000,
    filter: (m) =>
      m.customId === `blame_remove_select_${targetUser.id}` &&
      m.user.id === interaction.user.id,
    max: 1,
  });

  collector.on("collect", async (i) => {
    const blameId = i.values[0];
    const blame = await prisma.blame.delete({ where: { id: blameId } });

    const remaining = await prisma.blame.count({
      where: { userId: targetUser.id },
    });

    await i.update({
      content: null,
      components: [],
      embeds: [
        successEmbed(
          "Blame retiré",
          [
            `Blame retiré de **${targetUser.name}**.`,
            `**Raison :** ${blame.reason}`,
            `**Sévérité :** ${SEVERITY_EMOJI[blame.severity] || "⚠️"} ${blame.severity}`,
            `**Restant :** ${remaining} blame(s)`,
          ].join("\n")
        ),
      ],
    });
  });

  collector.on("end", async (collected) => {
    if (collected.size === 0) {
      try {
        await interaction.editReply({
          content: "⏱️ Annulé — aucun blame sélectionné.",
          components: [],
        });
      } catch {}
    }
  });
}
