/*
  Warnings:

  - A unique constraint covering the columns `[github_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "github_id" VARCHAR(32),
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_github_id_key" ON "user"("github_id");
