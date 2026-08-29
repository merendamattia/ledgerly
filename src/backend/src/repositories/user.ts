import { prisma } from "../core/db.ts";

const userFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

/** Data access for account metadata. Passwords remain owned by Better Auth. */
export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userFields });
  },

  list() {
    return prisma.user.findMany({
      select: userFields,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  },

  listIds() {
    return prisma.user.findMany({ select: { id: true } });
  },

  setMustChangePassword(id: string, mustChangePassword: boolean) {
    return prisma.user.update({
      where: { id },
      data: { mustChangePassword },
      select: userFields,
    });
  },
};
