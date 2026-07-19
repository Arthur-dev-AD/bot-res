const DEFCON_LEVELS = {
  1: {
    name: "CRITIQUE",
    status: "Severe / Alerte Maximale",
    color: "#ef4444",
    emoji: "\u26a0\ufe0f",
    description:
      "Autorisation d'alourdissement de l'\u00e9quipement vestimentaire ainsi que de l'usage de la tenue de crise. R\u00e8gles d'engagement relax\u00e9es.",
  },
  2: {
    name: "HAUT",
    status: "Alerte Renforc\u00e9e",
    color: "#f97316",
    emoji: "\ud83d\udd34",
    description:
      "Autorisation d'alourdissement de l'\u00e9quipement vestimentaire. R\u00e8gles d'engagement \u00e0 maintenir.",
  },
  3: {
    name: "\u00c9LEV\u00c9",
    status: "Vigilance Accrue",
    color: "#eab308",
    emoji: "\ud83d\udfe1",
    description:
      "Autorisation de porter un gilet pare lame/balle l\u00e9ger ou d'un gilet tactique. R\u00e8gles d'engagement standard.",
  },
  4: {
    name: "MOD\u00c9R\u00c9",
    status: "S\u00e9curit\u00e9 Renforc\u00e9e",
    color: "#3b82f6",
    emoji: "\ud83d\udd35",
    description:
      "Restez sur vos gardes mais rien de sp\u00e9cial. R\u00e8gles d'engagement standard.",
  },
  5: {
    name: "NORMAL",
    status: "Situation Normale",
    color: "#10b981",
    emoji: "\ud83d\udfe2",
    description: "Service standard.",
  },
};

function getDefconEmoji(level) {
  return DEFCON_LEVELS[level]?.emoji || "\u2753";
}

function getDefconColor(level) {
  return parseInt(DEFCON_LEVELS[level]?.color?.replace("#", ""), 16) || 0x999999;
}

function getDefconInfo(level) {
  return DEFCON_LEVELS[level] || DEFCON_LEVELS[5];
}

function formatDefconBar(level, max = 5) {
  const filled = "\u2588".repeat(max - level + 1);
  const empty = "\u2591".repeat(level - 1);
  return `\`${filled}${empty}\` **${level}/5**`;
}

module.exports = {
  DEFCON_LEVELS,
  getDefconEmoji,
  getDefconColor,
  getDefconInfo,
  formatDefconBar,
};
