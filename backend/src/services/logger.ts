import { emitLog } from '../websocket/socketServer';

export const logger = {
  log: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage(message, args);
    console.log(formattedMessage);
    emitLog(formattedMessage);
  },
  error: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage(message, args);
    console.error(formattedMessage);
    emitLog(`[ERROR] ${formattedMessage}`);
  },
  warn: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage(message, args);
    console.warn(formattedMessage);
    emitLog(`[WARN] ${formattedMessage}`);
  },
  info: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage(message, args);
    console.info(formattedMessage);
    emitLog(`[INFO] ${formattedMessage}`);
  }
};

function formatMessage(message: string, args: any[]): string {
  if (args.length === 0) return message;
  return `${message} ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')}`;
}
