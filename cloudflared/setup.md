# Cloudflare Tunnel Setup

## Step 1: Download cloudflared.exe

Download from: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe

Save as: `cloudflared/cloudflared.exe`

## Step 2: Login to Cloudflare

```bash
npm run tunnel:login
```

This will open a browser to authenticate with Cloudflare.

## Step 3: Create Tunnel

```bash
npm run tunnel:create
```

This creates a tunnel named "shoe-factory".

## Step 4: Configure DNS

You need a domain. If you don't have one, use Cloudflare's free subdomain.

```bash
npm run tunnel:route
```

## Step 5: Run Tunnel

```bash
npm run tunnel
```

Your app will be accessible at: https://shoe-factory.yourdomain.com

## Run Everything Together

```bash
npm run dev:tunnel
```

This starts frontend, backend, and tunnel together.
