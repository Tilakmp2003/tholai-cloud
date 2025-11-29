-- DropForeignKey
ALTER TABLE "Repo" DROP CONSTRAINT "Repo_projectId_fkey";

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
