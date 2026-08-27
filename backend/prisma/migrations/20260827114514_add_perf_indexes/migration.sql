-- CreateIndex
CREATE INDEX "AuditLog_createdAt_entityType_userId_idx" ON "AuditLog"("createdAt", "entityType", "userId");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");
