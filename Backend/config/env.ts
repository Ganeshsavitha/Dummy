import * as dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "enterprise-jwt-access-secret-key-12345",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "enterprise-jwt-refresh-secret-key-67890",
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  COOKIE_EXPIRY_DAYS: 7
};
