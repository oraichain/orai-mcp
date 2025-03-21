import { createLogger, format, transports } from "winston";
import TransportStream from "winston-transport";

class CaptureLastMessageTransport extends TransportStream {
  public lastMessage: string = "";
  public listMessages: string[] = [];

  constructor() {
    super();
    this.lastMessage = "";
  }

  log(info: any, callback: any) {
    this.lastMessage = info.message;
    this.listMessages.push(this.lastMessage);
    if (callback) callback();
  }

  resetMessages() {
    this.listMessages = [];
    this.lastMessage = "";
  }
}

export const captureTransport = new CaptureLastMessageTransport();

export const initLogger = (label: string, loglevel?: string) =>
  createLogger({
    level: loglevel || "info",
    format: format.combine(
      format.label({ label }),
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      format.printf((info) => {
        return `${info.timestamp} [${info.level.toUpperCase()}] [${
          info.label
        }]: ${info.message}`;
      })
    ),
    transports: [new transports.Console(), captureTransport],
  });
