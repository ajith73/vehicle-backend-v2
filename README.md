# Vehicle Assist Backend

Express + TypeScript API for the Vehicle Assist platform. It powers public mechanic discovery, admin authentication, dashboard analytics, mechanic approval workflows, feedback collection, donations, and settings management.

## Stack

- Express 5
- TypeScript
- Sequelize
- PostgreSQL
- JWT authentication
- bcrypt password hashing

## What This Service Does

- Exposes public endpoints for mechanics, vehicle types, service types, feedback, and donations
- Supports admin login and protected admin APIs
- Manages mechanics, including create, update, delete, bulk upload, and approval flows
- Supports role-based access for `Super Admin` and `Admin`
- Tracks update requests when non-super-admin users edit mechanics
- Provides dashboard metrics and activity logs
- Seeds default vehicle types, service types, roles, and a super admin user on startup

## Project Structure

- `src/index.ts`: app bootstrap, middleware, `/api` routes, health endpoint
- `src/routes/`: auth, public, and admin route groups
- `src/controllers/`: request handlers for auth, dashboard, mechanics, feedback, settings, and users
- `src/models/`: Sequelize models
- `src/config/database.ts`: database connection setup
- `src/seeders/index.ts`: schema sync and default seed data

## API Overview

Base path: `/api`

- `GET /health`
- `POST /auth/login`
- `GET /public/mechanics`
- `POST /public/feedback`
- `POST /public/donation`
- `GET /public/vehicles`
- `GET /public/services`
- `GET /admin/dashboard`
- `GET /admin/activity-logs`
- `GET|POST|PUT|DELETE /admin/users`
- `GET|POST|PUT|DELETE /admin/mechanics`
- `POST /admin/mechanics/bulk`
- `PUT /admin/mechanics/bulk/status`
- `POST /admin/mechanics/:id/approve`
- `GET /admin/update-requests`
- `POST /admin/update-requests/:id/approve`
- `POST /admin/update-requests/:id/reject`
- `GET|PUT|DELETE /admin/feedback`
- `GET /admin/donations`
- `POST|PUT|DELETE /admin/vehicles`
- `PUT /admin/vehicles/featured`
- `POST|PUT|DELETE /admin/services`
- `PUT /admin/services/featured`

## Environment Variables

Create a `.env` file in `vehicle-backend/`.

```env
PORT=5000
NODE_ENV=development
DATABASE_URL_LOCAL=postgres://username:password@localhost:5432/vehicle_assist
DATABASE_URL_PROD=postgres://username:password@host:5432/vehicle_assist
SUPERADMIN_USERNAME=admin@vehicle.com
SUPERADMIN_PASSWORD=change-me
JWT_SECRET=change-me
```

## Local Development

```bash
npm install
npm run dev
```

The server starts on `http://localhost:5000` by default and exposes the API at `http://localhost:5000/api`.

On startup the app will:

- connect to PostgreSQL
- run `sequelize.sync()`
- seed default vehicle and service types
- seed `Super Admin` and `Admin` roles
- create the super admin account if it does not already exist

## Scripts

- `npm run dev`: run the API with `nodemon`
- `npm run build`: compile TypeScript to `dist/`
- `npm run start`: start the compiled app in production-style mode

## Current Implementation Notes

- The codebase now uses PostgreSQL through Sequelize. Older SQLite/Vercel notes are no longer accurate.
- `src/config/database.ts` currently enables SSL options for every environment. If your local PostgreSQL instance does not support SSL, you will need to adjust that config.
- For Windows local runs, `npm run start` may be less portable because the script sets `NODE_ENV=production` inline. Running `node dist/index.js` after `npm run build` is the safer fallback.
