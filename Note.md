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

frontend:
npx create-next-app@latest frontend

npm install @reduxjs/toolkit react-redux @tanstack/react-table react-hook-form @hookform/resolvers zod echarts echarts-for-react date-fns react-day-picker clsx tailwind-merge class-variance-authority lucide-react

npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-toast @radix-ui/react-alert-dialog @radix-ui/react-tabs @radix-ui/react-avatar @radix-ui/react-separator @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-checkbox @radix-ui/react-switch

npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node @types/react @types/react-dom


npx tsc --noEmit