type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
const activeLevel = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;

const serializeError = (value: unknown) => {
  if (!(value instanceof Error)) return value;

  return {
    name: value.name,
    message: value.message,
    stack: value.stack
  };
};

const normalizeMeta = (meta?: Record<string, unknown>) => {
  if (!meta) return undefined;

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, serializeError(value)])
  );
};

const formatMeta = (meta?: Record<string, unknown>) => {
  if (!meta) return '';

  return Object.entries(meta)
    .map(([key, value]) => {
      if (value === undefined) return null;
      if (typeof value === 'object' && value !== null) {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${String(value)}`;
    })
    .filter(Boolean)
    .join(' ');
};

const writeLog = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  if (LOG_LEVELS[level] < activeLevel) return;

  const timestamp = new Date().toISOString();
  const normalizedMeta = normalizeMeta(meta);
  const line = `[${timestamp}] ${level.toUpperCase()} ${message}${formatMeta(normalizedMeta) ? ` ${formatMeta(normalizedMeta)}` : ''}`;

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('error', message, meta),
};

export const registerProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { error: reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('uncaught_exception', { error });
  });
};
