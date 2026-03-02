const isProduction = process.env.NODE_ENV === "production";

type LogArgs = unknown[];

function info(...args: LogArgs) {
  if (!isProduction) {
    console.log(...args);
  }
}

function debug(...args: LogArgs) {
  if (!isProduction) {
    console.debug(...args);
  }
}

function warn(...args: LogArgs) {
  console.warn(...args);
}

function error(...args: LogArgs) {
  console.error(...args);
}

export const logger = {
  info,
  debug,
  warn,
  error,
};
