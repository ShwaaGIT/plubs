**Secret Management**

- Purpose: Keep Google API keys and Supabase Service Role keys out of Git, restrict their use, and rotate immediately if exposed.

**Environment Variables**
- Local dev: Store secrets only in `.env.local` (gitignored).
- Server-only: `GOOGLE_MAPS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Client-only: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, optional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
- Production: Set the same names in your hosting provider’s environment settings (not in code).

**Rotation Steps**
- Supabase Service Role:
  - Supabase Console → Project Settings → API → Service role → Regenerate, then delete the old key.
  - Update your server environment and redeploy.
- Google API Keys:
  - Create two keys in Google Cloud → Credentials:
    - Server key: Restrict by API (Places API, etc.), ideally also by server IPs.
    - Browser key: Restrict by HTTP referrers (your domains) and only Maps JavaScript API.
  - Replace in env vars, then delete the old keys.

**Purging Secrets From Git History**
- Install git-filter-repo: `brew install git-filter-repo` or `pip install git-filter-repo`.
- Prepare a replacement file (see `tools/git-filter-repo-replacements.txt`).
- Example usage:
  - Replace text matches: `git filter-repo --replace-text tools/git-filter-repo-replacements.txt`
  - Remove env files: `git filter-repo --path .env --path .env.local --path .env.* --invert-paths`
- Force-push rewritten history:
  - `git push --force --all && git push --force --tags`
- Note: Anyone who cloned may still have the old data. Rotation is mandatory.

**Validation Checklist**
- Map loads via `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Places search works server-side via `GOOGLE_MAPS_API_KEY`.
- Supabase server routes work via `SUPABASE_SERVICE_ROLE_KEY`.
- No secrets present in repo: `rg -n "AIza|SUPABASE_SERVICE_ROLE|eyJ"` returns only docs/examples.

**Incident Response**
- Immediately rotate and revoke exposed keys, then purge history, then redeploy.
