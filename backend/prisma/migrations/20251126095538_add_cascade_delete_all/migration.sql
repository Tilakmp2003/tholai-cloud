-- DropForeignKey
ALTER TABLE "FileChunk" DROP CONSTRAINT "FileChunk_fileId_fkey";

-- DropForeignKey
ALTER TABLE "RepoFile" DROP CONSTRAINT "RepoFile_repoId_fkey";

-- DropForeignKey
ALTER TABLE "Symbol" DROP CONSTRAINT "Symbol_fileId_fkey";

-- AddForeignKey
ALTER TABLE "RepoFile" ADD CONSTRAINT "RepoFile_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Symbol" ADD CONSTRAINT "Symbol_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RepoFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChunk" ADD CONSTRAINT "FileChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RepoFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
