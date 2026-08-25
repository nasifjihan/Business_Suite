Install PostgreSQL 18.6 on Windows 11
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
Password: zeehan14
port: 5432
Open pgAdmin 4 -> create a new database -> name: business_suite
Add new Environment Variables: C:\Program Files\PostgreSQL\18\bin
psql --version

backend:
npm install
npx prisma init

.env DATABASE_URL

npx prisma migrate dev --name init_core_tables


npx create-next-app@latest frontend

