import * as fs from "fs";
import * as path from "path";

const logDirectory = path.join(__dirname, "../logs");
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logFilePath = path.join(logDirectory, "app.log");

export const Logger = {
  info(message: string, meta?: any) {
    const formatted = `[INFO] [${new Date().toISOString()}] ${message} ${meta ? JSON.stringify(meta) : ""}\n`;
    console.log(formatted.trim());
    try {
      fs.appendFileSync(logFilePath, formatted);
    } catch (e) {
      // Avoid breaking if running in read-only environment
    }
  },
  warn(message: string, meta?: any) {
    const formatted = `[WARN] [${new Date().toISOString()}] ${message} ${meta ? JSON.stringify(meta) : ""}\n`;
    console.warn(formatted.trim());
    try {
      fs.appendFileSync(logFilePath, formatted);
    } catch (e) { }
  },
  error(message: string, meta?: any) {
    const formatted = `[ERROR] [${new Date().toISOString()}] ${message} ${meta ? JSON.stringify(meta) : ""}\n`;
    console.error(formatted.trim());
    try {
      fs.appendFileSync(logFilePath, formatted);
    } catch (e) { }
  }
};
