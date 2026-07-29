import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import prisma from "../database/client";
import { ENV } from "../config/env";
import { ResponseHandler } from "../utils/response";
import { Logger } from "../utils/logger";

export const AuthController = {
  async register(req: Request, res: Response) {
    try {
      const { username, email, password, fullName, targetRole } = req.body;
      
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
      });
      if (existingUser) {
        return ResponseHandler.error(res, "Username or email is already registered.", 400);
      }

      // Fetch STUDENT role
      let studentRole = await prisma.role.findUnique({ where: { name: "STUDENT" } });
      if (!studentRole) {
        studentRole = await prisma.role.create({ data: { name: "STUDENT" } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          roleId: studentRole.id,
          profile: {
            create: {
              fullName,
              targetRole: targetRole || "Software Engineer"
            }
          }
        },
        include: { role: true, profile: true }
      });

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role.name },
        ENV.JWT_SECRET,
        { expiresIn: ENV.ACCESS_TOKEN_EXPIRY as any }
      );
      const refreshToken = jwt.sign(
        { id: user.id, username: user.username },
        ENV.JWT_REFRESH_SECRET,
        { expiresIn: ENV.REFRESH_TOKEN_EXPIRY as any }
      );

      // Save session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ENV.COOKIE_EXPIRY_DAYS);
      
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"]
        }
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTH_REGISTER_SUCCESS",
          ipAddress: req.ip,
          details: `Registered @${user.username}`
        }
      }).catch(() => {});

      Logger.info(`User registered successfully: @${username}`);

      return ResponseHandler.success(res, {
        accessToken,
        refreshToken,
        user: {
          username: user.username,
          fullName: user.profile?.fullName,
          targetRole: user.profile?.targetRole,
          streak: user.profile?.streak
        }
      }, "Registration completed successfully.", 201);
    } catch (error: any) {
      Logger.error("Registration error:", error);
      return ResponseHandler.error(res, "An error occurred during registration: " + error.message, 500);
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
        include: { role: true, profile: true }
      });
      if (!user) {
        return ResponseHandler.error(res, "Invalid username or password.", 401);
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return ResponseHandler.error(res, "Invalid username or password.", 401);
      }

      // Update login streak if not logged in today
      if (user.profile) {
        const today = new Date().toDateString();
        const lastActiveStr = new Date(user.profile.lastActive).toDateString();
        if (today !== lastActiveStr) {
          const diffTime = Math.abs(new Date(today).getTime() - new Date(lastActiveStr).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            user.profile.streak += 1;
          } else if (diffDays > 1) {
            user.profile.streak = 1;
          }
          await prisma.profile.update({
            where: { id: user.profile.id },
            data: { streak: user.profile.streak, lastActive: new Date() }
          });
        }
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role.name },
        ENV.JWT_SECRET,
        { expiresIn: ENV.ACCESS_TOKEN_EXPIRY as any }
      );
      const refreshToken = jwt.sign(
        { id: user.id, username: user.username },
        ENV.JWT_REFRESH_SECRET,
        { expiresIn: ENV.REFRESH_TOKEN_EXPIRY as any }
      );

      // Save Session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ENV.COOKIE_EXPIRY_DAYS);
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"]
        }
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTH_LOGIN_SUCCESS",
          ipAddress: req.ip,
          details: `Logged in @${user.username}`
        }
      }).catch(() => {});

      Logger.info(`User logged in successfully: @${username}`);

      return ResponseHandler.success(res, {
        accessToken,
        refreshToken,
        user: {
          username: user.username,
          fullName: user.profile?.fullName,
          targetRole: user.profile?.targetRole,
          streak: user.profile?.streak
        }
      }, "Login completed successfully.");
    } catch (error: any) {
      Logger.error("Login error:", error);
      return ResponseHandler.error(res, "An error occurred during login: " + error.message, 500);
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await prisma.session.deleteMany({
          where: { refreshToken }
        });
      }
      return ResponseHandler.success(res, {}, "Logged out successfully.");
    } catch (error: any) {
      Logger.error("Logout error:", error);
      return ResponseHandler.error(res, "An error occurred during logout: " + error.message, 500);
    }
  },

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return ResponseHandler.error(res, "Refresh token is required.", 400);
      }

      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: { include: { role: true } } }
      });

      if (!session || new Date() > session.expiresAt) {
        return ResponseHandler.error(res, "Invalid or expired session. Please log in again.", 401);
      }

      try {
        const decoded = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET) as { id: string; username: string };
        const accessToken = jwt.sign(
          { id: session.user.id, username: session.user.username, role: session.user.role.name },
          ENV.JWT_SECRET,
          { expiresIn: ENV.ACCESS_TOKEN_EXPIRY as any }
        );
        return ResponseHandler.success(res, { accessToken }, "Token refreshed successfully.");
      } catch (err) {
        return ResponseHandler.error(res, "Invalid refresh token verification.", 401);
      }
    } catch (error: any) {
      Logger.error("Refresh token error:", error);
      return ResponseHandler.error(res, "An error occurred refreshing token: " + error.message, 500);
    }
  }
};
