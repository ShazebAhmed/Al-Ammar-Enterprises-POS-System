# Database backups

Supabase's free plan keeps no backups we can download, so a GitHub Action
(`.github/workflows/database-backup.yml`) copies the live database every night at
02:00 Pakistan time.

- What is copied: the shop's tables (products, orders, customers' profiles, reviews,
  discount codes, settings, notifications), customer sign-ins (`auth`) and the photo
  records (`storage`). The photo files themselves stay in Supabase Storage.
- The copy is encrypted with the owner's passphrase (AES-256, `gpg`) before it leaves
  the runner, because it contains customers' names, phone numbers and addresses.
- Each copy is kept for 30 days under the workflow run's **Artifacts**. The
  repository is public, so anyone signed in to GitHub can download these files; they
  are useless without the passphrase, which is why it must be long.

## One-time setup (owner)

1. Supabase dashboard → **Connect** (top of the project page) → **Direct /
   Connection string** → method **Session pooler** → copy the string and replace
   `[YOUR-PASSWORD]` with the database password (forgotten: Project Settings →
   Database → Reset database password; the website does not use it). The "Direct
   connection" method does not work from GitHub, which has no IPv6.
2. Choose a long passphrase (at least 20 characters, for example five random words) and keep it somewhere safe, for
   example in your password manager. Without it the backups cannot be opened.
3. GitHub → the repository → **Settings → Secrets and variables → Actions → New
   repository secret**, and add:
   - `SUPABASE_DB_URL`: the connection string from step 1
   - `BACKUP_PASSPHRASE`: the passphrase from step 2
4. **Actions → Database backup → Run workflow** once to check it works.

Neither value is ever put in the code, a PR or a chat.

## Restoring

1. **Actions → Database backup →** the run from the day you want **→ Artifacts**,
   download it and unzip it: `alammar-db-YYYY-MM-DD.dump.gpg`.
2. Decrypt it (asks for the passphrase):
   `gpg --output alammar-db.dump --decrypt alammar-db-YYYY-MM-DD.dump.gpg`
3. See what is inside: `pg_restore --list alammar-db.dump`
4. Restore into a **new or spare** Supabase project first, never straight over the
   live shop: apply `supabase/migrations/` there, then
   `pg_restore --no-owner --no-privileges --data-only --schema=public -d "<that project's connection string>" alammar-db.dump`.
   Single tables can be restored with `--table=orders` and so on.

Ask Claude to do steps 3–4 with you; restoring over live data replaces newer orders.
