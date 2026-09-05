import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../core/db.ts";

export type PersonalApiTokenMetadata = {
  prefix: string;
  suffix: string;
  createdAt: string;
};

export type CreatedPersonalApiToken = {
  token: string;
  metadata: PersonalApiTokenMetadata;
};

const TOKEN_PREFIX = "ledgerly_";
const TOKEN_BYTES = 32;

function generateSecret(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toMetadata(record: { prefix: string; suffix: string; createdAt: Date }): PersonalApiTokenMetadata {
  return {
    prefix: record.prefix,
    suffix: record.suffix,
    createdAt: record.createdAt.toISOString(),
  };
}

function tokenData(userId: string, secret: string) {
  return {
    userId,
    tokenHash: hashSecret(secret),
    prefix: secret.slice(0, 10),
    suffix: secret.slice(-4),
  };
}

export const personalApiTokenRepository = {
  async findMetadata(userId: string): Promise<PersonalApiTokenMetadata | null> {
    const record = await prisma.personalApiToken.findUnique({
      where: { userId },
      select: { prefix: true, suffix: true, createdAt: true },
    });
    return record ? toMetadata(record) : null;
  },

  async create(userId: string): Promise<CreatedPersonalApiToken> {
    const token = generateSecret();
    const record = await prisma.personalApiToken.create({
      data: tokenData(userId, token),
      select: { prefix: true, suffix: true, createdAt: true },
    });
    return { token, metadata: toMetadata(record) };
  },

  async rotate(userId: string): Promise<CreatedPersonalApiToken> {
    const token = generateSecret();
    const data = tokenData(userId, token);
    const record = await prisma.personalApiToken.upsert({
      where: { userId },
      create: data,
      update: { ...data, createdAt: new Date() },
      select: { prefix: true, suffix: true, createdAt: true },
    });
    return { token, metadata: toMetadata(record) };
  },

  revoke(userId: string) {
    return prisma.personalApiToken.deleteMany({ where: { userId } });
  },

  findUserBySecret(secret: string) {
    return prisma.personalApiToken.findUnique({
      where: { tokenHash: hashSecret(secret) },
      select: { userId: true, prefix: true, suffix: true },
    });
  },
};
