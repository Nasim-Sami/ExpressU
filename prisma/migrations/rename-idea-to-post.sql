-- Rename Idea -> Post and Chapter -> Entry, preserving every existing row.
--
-- Prisma cannot express a rename: to its differ, `Idea` disappearing and `Post`
-- appearing is a DROP plus a CREATE, which would take the data with it. So the rename
-- is done by hand here first, and `prisma db push` afterwards only has to reconcile
-- indexes and the new columns.
--
-- SQLite propagates renames into foreign-key clauses in other tables automatically
-- (legacy_alter_table is off by default), so the FK graph survives untouched.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Drop the old indexes up front. They carry no data, and leaving them under their old
-- names would collide with the ones Prisma is about to create.
DROP INDEX IF EXISTS "Idea_authorId_idx";
DROP INDEX IF EXISTS "Idea_moderationStatus_visibility_lastChapterAt_idx";
DROP INDEX IF EXISTS "Chapter_ideaId_idx";
DROP INDEX IF EXISTS "Chapter_ideaId_ordinal_key";
DROP INDEX IF EXISTS "Attachment_chapterId_idx";
DROP INDEX IF EXISTS "Love_ideaId_idx";
DROP INDEX IF EXISTS "Love_ideaId_userId_key";
DROP INDEX IF EXISTS "Echo_ideaId_idx";
DROP INDEX IF EXISTS "Echo_ideaId_userId_key";
DROP INDEX IF EXISTS "Encouragement_ideaId_idx";
DROP INDEX IF EXISTS "ModerationRun_chapterId_idx";
DROP INDEX IF EXISTS "Report_ideaId_reporterId_key";

-- Post ------------------------------------------------------------------------
ALTER TABLE "Idea" RENAME TO "Post";
ALTER TABLE "Post" RENAME COLUMN "lastChapterAt" TO "lastEntryAt";
ALTER TABLE "Post" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'IDEA';
ALTER TABLE "Post" ADD COLUMN "hobbyName" TEXT;
ALTER TABLE "Post" ADD COLUMN "recipientType" TEXT;

-- Entry -----------------------------------------------------------------------
ALTER TABLE "Chapter" RENAME TO "Entry";
ALTER TABLE "Entry" RENAME COLUMN "ideaId" TO "postId";
ALTER TABLE "Entry" ADD COLUMN "letterTo" TEXT;
ALTER TABLE "Entry" ADD COLUMN "letterSubject" TEXT;
-- Prisma's @updatedAt column is NOT NULL. SQLite needs a constant default to add a
-- NOT NULL column to a populated table, so add it with 0 and immediately backfill:
-- an entry that has never been edited was last touched when it was written.
ALTER TABLE "Entry" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT 0;
UPDATE "Entry" SET "updatedAt" = "createdAt";

-- Foreign-key columns on the satellite tables ---------------------------------
ALTER TABLE "Attachment" RENAME COLUMN "chapterId" TO "entryId";
ALTER TABLE "Love" RENAME COLUMN "ideaId" TO "postId";
ALTER TABLE "Echo" RENAME COLUMN "ideaId" TO "postId";
ALTER TABLE "Encouragement" RENAME COLUMN "ideaId" TO "postId";
ALTER TABLE "ModerationRun" RENAME COLUMN "chapterId" TO "entryId";
ALTER TABLE "Strike" RENAME COLUMN "chapterId" TO "entryId";
ALTER TABLE "Report" RENAME COLUMN "ideaId" TO "postId";

COMMIT;

PRAGMA foreign_keys = ON;
