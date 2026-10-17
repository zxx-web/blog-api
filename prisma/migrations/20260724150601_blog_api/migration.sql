-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "post_revisions" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_revisions_post_id_created_at_idx" ON "post_revisions"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_revisions_post_id_version_key" ON "post_revisions"("post_id", "version");

-- AddForeignKey
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
