import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import prisma from "../database/client";
import { ResponseHandler } from "../utils/response";
import { Logger } from "../utils/logger";

export const ProfileController = {
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const username = req.user?.username;
      if (!username) {
        return ResponseHandler.error(res, "Access token payload is missing identity details.", 400);
      }

      const user = await prisma.user.findUnique({
        where: { username },
        include: { role: true, profile: true }
      });

      if (!user) {
        return ResponseHandler.error(res, "User profile not found.", 404);
      }

      return ResponseHandler.success(res, {
        username: user.username,
        email: user.email,
        role: user.role.name,
        profile: user.profile
      }, "Profile retrieved successfully.");
    } catch (error: any) {
      Logger.error("Get profile failed:", error);
      return ResponseHandler.error(res, "An error occurred retrieving profile: " + error.message, 500);
    }
  },

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const username = req.user?.username;
      if (!username) {
        return ResponseHandler.error(res, "Access token payload is missing identity details.", 400);
      }

      const { fullName, targetRole, details } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
        include: { profile: true }
      });

      if (!user || !user.profile) {
        return ResponseHandler.error(res, "User profile not found.", 404);
      }

      const updatedProfile = await prisma.profile.update({
        where: { id: user.profile.id },
        data: {
          fullName: fullName || user.profile.fullName,
          targetRole: targetRole || user.profile.targetRole,
          details: details || user.profile.details
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PROFILE_UPDATE_SUCCESS",
          ipAddress: req.ip,
          details: `Updated profile details for @${user.username}`
        }
      }).catch(() => {});

      Logger.info(`Profile updated for @${user.username}`);

      return ResponseHandler.success(res, {
        profile: updatedProfile
      }, "Profile updated successfully.");
    } catch (error: any) {
      Logger.error("Update profile failed:", error);
      return ResponseHandler.error(res, "An error occurred updating profile: " + error.message, 500);
    }
  }
};
