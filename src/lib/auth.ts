import { betterAuth } from "better-auth";
import { organization, twoFactor, admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { getPlatformName } from "./platform";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const pName = await getPlatformName();
      await sendEmail({
        to: user.email,
        subject: `Reset your ${pName} password`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Click the button below to reset your password.</p>
            <p>
              <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const pName = await getPlatformName();
      await sendEmail({
        to: user.email,
        subject: `Verify your ${pName} email`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your Email</h2>
            <p>Click the button below to verify your email address.</p>
            <p>
              <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Verify Email
              </a>
            </p>
          </div>
        `,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
      organizationLimit: 5,
      creatorRole: "owner",
      memberRoleHierarchy: ["owner", "admin", "manager", "member", "staff", "warehouse", "viewer"],
      sendInvitationEmail: async (data) => {
        const pName = await getPlatformName();
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `You've been invited to ${data.organization.name} on ${pName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been invited to join ${data.organization.name}</h2>
              <p>You've been invited to join <strong>${data.organization.name}</strong> as a <strong>${data.role}</strong> on ${pName}.</p>
              <p>
                <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
            </div>
          `,
        });
      },
    }),
    twoFactor({
      issuer: "GearFlow",
    }),
    admin(),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Enforce registration policy
          const settings = await prisma.siteSettings.findFirst();
          const policy = settings?.registrationPolicy ?? "OPEN";
          if (policy === "DISABLED" || policy === "INVITE_ONLY") {
            // Allow if this is the very first user (bootstrap)
            const count = await prisma.user.count();
            if (count > 0) {
              // Allow if this user has a pending invitation (invited by org admin or site admin)
              const pendingInvite = await prisma.invitation.findFirst({
                where: {
                  email: (user as { email?: string }).email?.toLowerCase(),
                  status: "pending",
                  expiresAt: { gte: new Date() },
                },
              });
              if (!pendingInvite) {
                throw new Error(
                  policy === "DISABLED"
                    ? "Registration is currently disabled."
                    : "Registration is invite-only. Contact an administrator.",
                );
              }
            }
          }
          return undefined;
        },
        after: async (user) => {
          // Auto-promote first user to site admin
          const count = await prisma.user.count();
          if (count === 1) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "admin" },
            });
          }
        },
      },
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});
