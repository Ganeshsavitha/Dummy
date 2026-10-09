# Production deployment

## MongoDB setup

Create a MongoDB Atlas cluster and database user, allow the Render service to reach the cluster, and copy the driver connection string. Use a dedicated database name such as `hiregrad`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/hiregrad?retryWrites=true&w=majority
MONGODB_TIMEOUT_MS=10000
MONGODB_MAX_POOL_SIZE=20
```

Do not commit this URI. Escape reserved characters in the username or password with URL encoding.

## Required environment variables

- `NODE_ENV=production`
- `MONGODB_URI`: MongoDB Atlas or replica-set connection string
- `JWT_SECRET`: at least 32 random characters
- `ALLOWED_ORIGINS`: comma-separated HTTPS frontend origins
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: required when the database has no admin; password must contain at least 12 characters
- At least one of `GEMINI_API_KEY` or `GROQ_API_KEY`
- `ENABLE_DEMO_SEED=false`

The application creates MongoDB collections and indexes through Mongoose during startup. The HTTP server starts only after MongoDB connects and model indexes initialize successfully.

## Build and run

```bash
npm install
npm run build
npm start
```

Check readiness at `GET /api/health`.

## Operational notes

- Use a MongoDB Atlas replica set; multi-document question replacement uses transactions when the server supports them.
- Rotate `ADMIN_PASSWORD` after bootstrap and remove it from the environment once the admin exists.
- Configure Atlas backups, point-in-time recovery, alerts, and least-privilege database credentials.
- The current coding evaluator is AI-based static analysis, not an isolated code execution sandbox.
- Reliable WebRTC across restrictive networks requires a managed TURN server.
- Horizontal Socket.io scaling requires a shared adapter such as Redis.
