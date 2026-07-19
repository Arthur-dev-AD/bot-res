function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

function parseDuration(str) {
  const match = str.match(/(\d+)\s*(j|h|m|s)/g);
  if (!match) return null;

  let totalMs = 0;
  for (const part of match) {
    const [, value, unit] = part.match(/(\d+)(j|h|m|s)/);
    const num = parseInt(value, 10);
    switch (unit) {
      case "j":
        totalMs += num * 24 * 60 * 60 * 1000;
        break;
      case "h":
        totalMs += num * 60 * 60 * 1000;
        break;
      case "m":
        totalMs += num * 60 * 1000;
        break;
      case "s":
        totalMs += num * 1000;
        break;
    }
  }
  return totalMs;
}

function isWithinRange(date, start, end) {
  const d = new Date(date);
  return d >= new Date(start) && d <= new Date(end);
}

function isExpired(date) {
  return new Date(date) < new Date();
}

function formatDiscordTimestamp(date, style = "R") {
  const ts = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${ts}:${style}>`;
}

module.exports = {
  formatDuration,
  parseDuration,
  isWithinRange,
  isExpired,
  formatDiscordTimestamp,
};
