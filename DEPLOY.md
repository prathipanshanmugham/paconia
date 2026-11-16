# Deploying Paconia on the Hostinger VPS

Paconia runs in Docker next to Kraftshed and the Triagon ERP. The installer finds the Caddy container that already
fronts the server, joins its network and adds a site block for the Paconia domain (on a plain server it uses
Nginx + certbot instead). Its database and uploads are separate from the other apps.

## 1. Point the domain

At the registrar for **paconia.com**, add two **A records** to the VPS IP (the same IP Kraftshed uses):

| Type | Name | Value |
|---|---|---|
| A | `@` | VPS IP |
| A | `www` | VPS IP |

## 2. Install (first time)

```bash
ssh root@<vps-ip>
git clone https://github.com/prathipanshanmugham/paconia.git /opt/paconia
cd /opt/paconia
bash deploy/bootstrap.sh paconia.com <your-email>
```

`www.paconia.com` redirects to `paconia.com`. It takes 5–8 minutes and ends by printing the **owner login**. Sign in at `https://paconia.com/desk`, then:

1. **Settings → Team** — change the owner password; add staff with their roles.
2. **Settings → Business** — check address, GSTIN, bank and UPI details (printed on invoices).
3. **Stock** — enter opening stock (use *Adjust stock → Physical count*) and correct material costs.
4. **Catalogue → Pricing rates** — check click, lamination, cutting and laser rates against your real costs.

## 3. Turn on online payments (Razorpay)

Razorpay needs the policy pages, which are already live at `/policies/terms`, `/policies/privacy`,
`/policies/refunds` and `/policies/shipping` (have your CA or lawyer review the wording).

```bash
cd /opt/paconia && nano .env
#   RAZORPAY_KEY_ID="rzp_live_..."
#   RAZORPAY_KEY_SECRET="..."
#   RAZORPAY_WEBHOOK_SECRET="..."      # any strong string; use the same one in the Razorpay dashboard
./deploy/deploy.sh
```

In the Razorpay dashboard add a webhook to `https://paconia.com/api/razorpay/webhook` with the events
`payment.captured` and `order.paid`.

Until keys are set, the website offers **pay at pickup** only. `PAYMENTS_DEMO="1"` simulates payments for testing —
never leave it on in production.

## 4. Updates

```bash
cd /opt/paconia && ./deploy/deploy.sh      # git pull, backup, rebuild, migrate, restart
```

## 5. Backups

`deploy/backup.sh` saves the database and all uploaded files to `/opt/paconia/backups` (kept 14 days).
Schedule it nightly:

```bash
(crontab -l 2>/dev/null; echo "30 2 * * * /opt/paconia/deploy/backup.sh >> /var/log/paconia-backup.log 2>&1") | crontab -
```

Copy the `backups` folder off the server now and then (Google Drive, another machine).

## Useful commands

```bash
docker compose logs -f web                       # app logs
docker compose ps                                # status
docker compose run --rm tools npx tsx prisma/seed.ts   # re-run seed (adds missing products/materials only)
docker exec -it paconia-db psql -U paconia paconia     # database shell
```
