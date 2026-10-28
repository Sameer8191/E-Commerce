# Deploy the E Commerce API to AWS

The frontend stays on Vercel. This repository's API is Node.js/Express and uses MongoDB (Mongoose) and Cloudinary, so keep using MongoDB Atlas and Cloudinary; this deployment does not create an RDS database or an S3 image bucket.

This guide deploys the backend container to Amazon ECS Express Mode. AWS App Runner is closed to new customers. ECS Express Mode requires a container image in Amazon ECR.

## 1. Prepare credentials and services

Before deploying, have these ready:

- An AWS account and AWS CLI configured for the account and Region you will use.
- Docker Desktop running, with the `docker` command available.
- MongoDB Atlas connection string. The database must be a replica set or sharded cluster because order operations use MongoDB transactions. Configure Atlas network access to permit connections from the ECS service. For production, use fixed outbound IPs (for example, a NAT gateway with an Elastic IP) and allowlist only those IPs in Atlas.
- Cloudinary credentials. Product images are already stored through Cloudinary.
- A random `JWT_SECRET` with at least 32 bytes. Set `OTP_HMAC_SECRET` to a separate random secret with at least 32 bytes.
- Razorpay and Brevo credentials if those integrations are enabled in your store.

Do not commit real credentials or put backend secrets in Vercel frontend variables.

## 2. Build and push the backend image to ECR

From PowerShell, run the following in this `backend` directory. Replace `ap-south-1` with your chosen AWS Region and `shop-api` with your preferred repository name.

```powershell
$Region = "ap-south-1"
$Repository = "shop-api"
$AccountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { throw "AWS CLI is not configured for an account" }

aws ecr describe-repositories --repository-names $Repository --region $Region *> $null
if ($LASTEXITCODE -ne 0) {
  aws ecr create-repository --repository-name $Repository --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Could not create ECR repository" }
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry
if ($LASTEXITCODE -ne 0) { throw "ECR login failed" }

docker build -t $Repository .
if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }
docker tag "$Repository`:latest" "$Registry/$Repository`:latest"
docker push "$Registry/$Repository`:latest"
if ($LASTEXITCODE -ne 0) { throw "Image push failed" }

Write-Host "Image URI: $Registry/$Repository`:latest"
```

Copy the printed image URI. For later releases, rerun the build, tag, and push commands after changing the code. Prefer a unique image tag for production releases so you can identify and roll back versions.

## 3. Create the ECS Express Mode service

1. Open **Amazon ECS** in the AWS Console, choose **Express mode**, and create a service using the ECR image URI from Step 2.
2. Set the container port to `5000` and health-check path to `/` (the API root returns HTTP 200).
3. Start with one task. Choose a VPC and subnets that provide outbound access to MongoDB Atlas, Cloudinary, Razorpay, and Brevo as needed.
4. Add the required environment variables from `backend/.env.example`. Set `NODE_ENV=production`, `PORT=5000`, and `TRUST_PROXY_HOPS=1`.
5. Store credentials (`MONGO_URI`, `JWT_SECRET`, Cloudinary secrets, and payment/email secrets) in AWS Secrets Manager and configure them as ECS secret environment variables. Add `CORS_ORIGINS` as a regular environment variable with your exact Vercel production origin, for example `https://your-store.vercel.app`.
6. Create the service. Wait until it is active and the health check passes. Copy its HTTPS application URL.

The API must be able to reach your Atlas cluster. When using a private database allowlist, configure stable outbound IP addresses for the ECS tasks (typically through a NAT gateway with an Elastic IP) before restricting Atlas access. Avoid allowing `0.0.0.0/0` in Atlas for a production database.

## 4. Point Vercel at the API

In the Vercel project for the frontend:

1. Open **Settings → Environment Variables**.
2. Add `VITE_API_URL` with the ECS HTTPS URL, for example `https://your-service.ecs.ap-south-1.on.aws` (no trailing slash is needed).
3. Set it for **Production** and for **Preview** only if preview deployments should call this API.
4. Redeploy the frontend. Vite embeds this value at build time, so an existing deployment will not pick it up until a new build.

The API's `CORS_ORIGINS` must include the exact origin of the site making requests. If Vercel preview deployments need API access, add only the specific preview origins you intend to allow, comma-separated.

## 5. Verify the live store

- Open `https://YOUR-ECS-URL/`; expect JSON saying the API is running.
- Check the ECS service's CloudWatch logs for startup and database connection errors.
- From the Vercel site, load products, sign in, place a test order, and test the Razorpay webhook using the configured webhook URL `https://YOUR-ECS-URL/api/payments/webhook` (confirm the exact route in the payment routes before configuring Razorpay).
- Confirm Atlas connections succeed and product image uploads still work through Cloudinary.

## Notes

- The project runs recurring jobs inside the API process. Keep at least one ECS task running; running multiple tasks will run each scheduled job on each task, so use a separate single-task worker or distributed locking before scaling beyond one task.
- ECS, the load balancer, NAT gateway, Atlas, and third-party services can incur charges. Review AWS pricing before creating production resources.
