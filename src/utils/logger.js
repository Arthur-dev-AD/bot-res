const LOG_LEVELS = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  DEBUG: "DEBUG",
};

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, component, message, data = null) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level}] [${component}]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function info(component, message, data) {
  log(LOG_LEVELS.INFO, component, message, data);
}

function warn(component, message, data) {
  log(LOG_LEVELS.WARN, component, message, data);
}

function error(component, message, data) {
  log(LOG_LEVELS.ERROR, component, message, data);
}

function debug(component, message, data) {
  log(LOG_LEVELS.DEBUG, component, message, data);
}

module.exports = { info, warn, error, debug, LOG_LEVELS };
