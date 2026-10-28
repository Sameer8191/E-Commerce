# Deploy the storefront and API to Vercel

This repository is configured as a Vercel Services project. Set the Vercel project's root directory to this folder and its framework preset to **Services**. The frontend is public at `/`; `/api/*` is routed to the Express backend.

## Environment variables

Add backend secrets and settings to the Vercel project for the backend service:

- `MONGO_URI`: MongoDB Atlas connection string for a replica set or sharded cluster; the application uses transactions.
- `JWT_SECRET`: random secret with at least 32 bytes.
- `CORS_ORIGINS`: comma-separated exact origins for the production and any permitted preview storefronts.
- `CRON_SECRET`: random secret used to protect scheduled maintenance endpoints.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for image storage.
- Add `OTP_HMAC_SECRET`, Razorpay credentials, and Brevo/email settings when those features are enabled. See `backend/.env.example` if present in your checkout.

The frontend calls the same origin at `/api`, so it does not need a public backend URL or a Vercel service binding. For local Vite development, `/api` proxies to `http://localhost:5000`.

## Scheduled maintenance

Vercel Hobby only supports daily cron schedules. This repository uses a GitHub Actions workflow instead. It calls both protected maintenance endpoints every five minutes; this means pending refunds are reconciled every five minutes rather than every minute.

In GitHub, add:

- A repository **variable** named `VERCEL_APP_URL` with the production deployment origin, such as `https://your-store.vercel.app`.
- A repository **secret** named `CRON_SECRET` with the same random value configured as `CRON_SECRET` in Vercel.

The workflow sends `Authorization: Bearer <CRON_SECRET>` and fails if either endpoint returns an error. It also supports manual runs with `workflow_dispatch`. GitHub scheduled workflows run from the default branch and can be delayed during periods of high load, so they do not guarantee exact five-minute timing. See [GitHub's schedule event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

## Payment webhooks

Configure the Razorpay webhook URL using the Vercel project domain and the payment webhook route from the backend, `/api/payments/webhook`.
