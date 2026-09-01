CREATE TABLE "personal_api_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_api_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_api_token_userId_key" ON "personal_api_token"("userId");
CREATE UNIQUE INDEX "personal_api_token_tokenHash_key" ON "personal_api_token"("tokenHash");

ALTER TABLE "personal_api_token" ADD CONSTRAINT "personal_api_token_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
