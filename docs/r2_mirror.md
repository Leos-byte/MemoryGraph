# Cloudflare R2 Release Mirror

This is an optional download mirror. GitHub Releases remains the source of truth;
the Electron updater still uses GitHub. No installer, updater file, signature or
published release is rebuilt or changed by the mirror.

## One-Time Setup

1. In Cloudflare R2, create `memorygraph-releases`. Storage and requests may incur
   charges beyond the free allowances; confirm the applicable billing settings.
2. Connect `download.leoone.uk` under the bucket's Settings > Custom Domains and
   wait until it is active. Do not expose a bucket containing private data.
3. Create an R2 S3 API token with Object Read & Write permission limited to this
   bucket. Use the S3 Access Key ID and Secret Access Key, not the dashboard API
   bearer token. Copy the account ID from the R2 S3 endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. In GitHub repository Settings > Secrets and variables > Actions, add repository
   secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Never put
   their values in source, Issues, PRs or chat. The account ID must be 32 hex digits.
5. After PR #2 is merged, run the workflow **Mirror GitHub Releases to Cloudflare
   R2** manually on `main`, with tag `v0.2.0-beta.2` for the first backfill. The
   target must already be a published, signed GitHub Release, not a draft.
6. Verify the workflow result, its download links, and the public files as
   described below. Only then add the repository **variable**
   `R2_MIRROR_ENABLED=true` to enable automatic mirroring. This is a variable, not
   a secret. Leave it unset, or set it to `false`, to keep automatic uploads off.

Before configuration, automatic runs are skipped. A manual run fails clearly if
required secrets are missing. This does not block ordinary Electron CI/releases.

## Operation And Recovery

- Published stable and beta releases can trigger mirroring after opt-in. A
  successful main-owned manual `Electron Release` workflow can also trigger a
  check, but drafts are always skipped. Since the release builder creates a
  draft, public publication or a later manual backfill is still necessary.
- Workflow completion triggers are restricted to the canonical repository,
  `main`, successful results and `workflow_dispatch`. Verification scripts and
  the public key are checked out from `main`, never an upstream PR or artifact.
- The workflow downloads only GitHub Release assets and verifies the existing
  Ed25519 signature, required platforms, sizes, SHA-512 hashes and file allowlist
  with `DevScripts/release-artifacts.mjs check-signed` before any R2 writes.
- R2 credentials are available only to the upload step. Downloaded installers
  are never executed, unpacked or used as workflow code. No npm install is needed.
- Objects use `releases/<tag>/<original-filename>`. Package/updater bytes are
  copied first, then the signature, then the manifest. No object deletion or
  bucket/DNS configuration is performed by this workflow.
- One global concurrency group prevents overlapping writes from duplicate
  events. GitHub can replace a pending run with a newer pending run; use manual
  backfill if a release's mirror run was cancelled or missed.
- After a failed upload, the prefix may be incomplete. Do not advertise it as
  verified. Retry the same published tag manually; identical signed files can
  be copied again without changing GitHub. Never move a published tag or replace
  public GitHub assets to repair a mirror.

## Public Verification

The first manifest should be available at:

`https://download.leoone.uk/releases/v0.2.0-beta.2/release-manifest.json`

Download the manifest, signature and all files named by the manifest into a fresh
directory, preserving filenames. From the repository root, verify them with:

```bash
node DevScripts/release-artifacts.mjs check-signed --source /path/to/downloads --version 0.2.0-beta.2
```

Successful CI with mocked uploads does not prove bucket access, custom-domain
availability or regional download performance. Those need a real configured run
and downloads from the intended user networks. No successful live mirror is
claimed until this verification is recorded.

## References

- [Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/)
- [R2 public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [GitHub release and workflow-run events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
