import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { OAuth2Client } from "google-auth-library";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} from "../../../shared/errors";
import { AuthenticatedRequest } from "../../../shared/types";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";

function generateTokens(userId: string, orgId?: string) {
  const accessToken = jwt.sign({ userId, orgId }, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId, orgId }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export function createAuthRouter(prisma: PrismaClient) {
  const router = Router();

  // POST /auth/google
  router.post(
    "/google",
    body("idToken").notEmpty(),
    errorPassthrough(async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const { idToken } = req.body;

      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        throw new UnauthorizedError("Invalid Google ID token");
      }

      if (!payload || !payload.email) {
        throw new UnauthorizedError("Invalid Google ID token payload");
      }

      const { email, name: googleName, sub: googleId } = payload;
      const displayName = googleName || email.split("@")[0];

      // Find or create the user
      let user;
      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: {
          organizationUsers: {
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (existingUser) {
        // Update authProvider to google if not already set
        if (existingUser.authProvider !== "google") {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { authProvider: "google" },
          });
        }
        user = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          orgId: existingUser.organizationUsers[0]?.orgId,
        };
      } else {
        // Create new user with personal organization
        const created = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              id: uuidv4(),
              email,
              name: displayName,
              passwordHash: null,
              authProvider: "google",
            },
          });

          const org = await tx.organization.create({
            data: {
              id: uuidv4(),
              name: `${displayName}'s Workspace`,
              planTier: "starter",
              monthlyMatchLimit: 500,
              matchesUsedThisPeriod: 0,
              billingPeriodStart: new Date(),
            },
          });

          await tx.organizationUser.create({
            data: {
              id: uuidv4(),
              orgId: org.id,
              userId: newUser.id,
              role: "owner",
            },
          });

          return { ...newUser, orgId: org.id };
        });

        user = {
          id: created.id,
          email: created.email,
          name: created.name,
          orgId: created.orgId,
        };
      }

      const tokens = generateTokens(user.id, user.orgId);

      res.json({
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          ...tokens,
        },
      });
    })
  );

  // POST /auth/signup
  router.post(
    "/signup",
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("name").trim().notEmpty(),
    errorPassthrough(async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const { email, password, name } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictError("Email already in use");
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            id: uuidv4(),
            email,
            name,
            passwordHash,
            authProvider: "email",
          },
        });

        // Create a personal organization for the user
        const org = await tx.organization.create({
          data: {
            id: uuidv4(),
            name: `${name}'s Workspace`,
            planTier: "starter",
            monthlyMatchLimit: 500,
            matchesUsedThisPeriod: 0,
            billingPeriodStart: new Date(),
          },
        });

        await tx.organizationUser.create({
          data: {
            id: uuidv4(),
            orgId: org.id,
            userId: newUser.id,
            role: "owner",
          },
        });

        return { ...newUser, orgId: org.id };
      });

      const tokens = generateTokens(user.id, user.orgId);

      res.status(201).json({
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          ...tokens,
        },
      });
    })
  );

  // POST /auth/login
  router.post(
    "/login",
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
    errorPassthrough(async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          organizationUsers: {
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!user || !user.passwordHash) {
        throw new UnauthorizedError("Invalid email or password");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError("Invalid email or password");
      }

      const orgId = user.organizationUsers[0]?.orgId;
      const tokens = generateTokens(user.id, orgId);

      res.json({
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          ...tokens,
        },
      });
    })
  );

  // POST /auth/refresh
  router.post(
    "/refresh",
    body("refreshToken").notEmpty(),
    errorPassthrough(async (req, res) => {
      const { refreshToken } = req.body;

      try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as {
          userId: string;
          orgId?: string;
        };

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user) {
          throw new UnauthorizedError("User not found");
        }

        const tokens = generateTokens(decoded.userId, decoded.orgId);
        res.json({ data: tokens });
      } catch {
        throw new UnauthorizedError("Invalid refresh token");
      }
    })
  );

  // GET /auth/me
  router.get(
    "/me",
    verifyToken,
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          organizationUsers: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  planTier: true,
                  monthlyMatchLimit: true,
                  matchesUsedThisPeriod: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      res.json({ data: user });
    })
  );

  return router;
}
