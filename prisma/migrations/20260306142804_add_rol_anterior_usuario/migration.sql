-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleAnterior" "Role",
ADD COLUMN     "roleExpiration" TIMESTAMP(3);
