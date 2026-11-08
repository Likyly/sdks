# Releasing

How a package goes from a commit to its registry, and the one-time setup each registry needs.
Day-to-day: see "Versions and releases" in the [README](../README.md).

## GitHub (once)

1. **Environment `publish`** (Settings → Environments): *Required reviewers* = the people allowed to approve a
   publication; *Deployment branches* = `main` only. Every run of `release.yml` stops on it before publishing.
2. **Environment `publish-credentials`**: no reviewer, *Deployment branches* = `main` only. It holds the only
   stored secrets:
   - `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_PASSWORD`: a Central Portal *user token* (not the account password).
   - `MAVEN_GPG_PRIVATE_KEY` (armored), `MAVEN_GPG_PASSPHRASE`: the signing key; its public key on keys.openpgp.org.
   - `PHP_MIRROR_DEPLOY_KEY`, `LARAVEL_MIRROR_DEPLOY_KEY`, `GO_MIRROR_DEPLOY_KEY`: private halves of SSH deploy
     keys that have **write** access to `Likyly/likyly-php`, `Likyly/likyly-laravel` and `Likyly/likyly-go`
     respectively (and nothing else).
3. **Variable `NUGET_USER`** (Settings → Variables): the nuget.org account that owns the `Likyly` package.
4. Settings → Actions → General: *Allow GitHub Actions to create and approve pull requests* (release-please).

## Registries (once per package)

Every trusted publisher below points at: owner `Likyly`, repository `sdks`, workflow `release.yml`
(leave the environment field empty: approval happens in the `approval` job, before the publishing jobs).

| Package | Registry | Setup |
|---|---|---|
| `@likyly/sdk`, `@likyly/react`, `@likyly/mcp-server` | npm | Create the `likyly` organization. npm only lets you add a trusted publisher to a package that exists, so the **first** version of each is published by hand (`npm publish` from the package directory, 2FA), then: package → Settings → Trusted publisher → GitHub Actions. Then disallow tokens for publishing. |
| `likyly` | PyPI | Account → Publishing → *Add a pending publisher* (project name `likyly`). Works before the first upload. |
| `likyly` | crates.io | The first version is published by hand (`cargo publish` with a token), then crate → Settings → Trusted Publishing. |
| `likyly` | RubyGems | Account → Trusted publishers → *pending* publisher for gem `likyly`. Works before the first push. |
| `Likyly` | NuGet | nuget.org → Trusted Publishing → policy for repository `Likyly/sdks`, workflow `release.yml`. |
| `com.likyly:likyly-sdk` | Maven Central | central.sonatype.com: register the `com.likyly` namespace (proved by a DNS TXT record on likyly.com), generate a user token, create and publish the GPG key. |
| `likyly/sdk` | Packagist | Create `Likyly/likyly-php` (public, empty), let the first release fill it, then *Submit* its URL on packagist.org and enable the GitHub hook so every tag is picked up. |
| `likyly/laravel` | Packagist | Same as `likyly/sdk`, with `Likyly/likyly-laravel` and `LARAVEL_MIRROR_DEPLOY_KEY`. Publish `likyly/sdk` first: the Laravel package requires it. |
| `github.com/likyly/likyly-go` | Go | Create `Likyly/likyly-go` (public, empty). The release pushes the code and the `vX.Y.Z` tag; `go get github.com/likyly/likyly-go@vX.Y.Z` works right after (pkg.go.dev indexes it on first fetch). |

## Current versions

[.release-please-manifest.json](../.release-please-manifest.json) holds the version of each package that is on
its registry. No package has a release tag here yet (the first versions were published by hand or by a manual
run), so `bootstrap-sha` in [release-please-config.json](../release-please-config.json) tells release-please
where to start reading commits; the first tagged release of a package makes it irrelevant for that package.

To publish the current version of a package (a package that is not on its registry yet): Actions → **Release** →
*Run workflow* → pick the package. It tests, waits for approval, publishes that version. Otherwise, releases come
from release-please pull requests only.

## What stays in the private backend

- The API itself and its OpenAPI document (`docs/openapi.json` there, published at
  `https://api.likyly.com/recsys-api/openapi.json`). When the API changes, copy it into `conformance/openapi.json`
  here; the weekly `Contract` job reports any difference.
- The live tests: `conformance/local-api.sh` needs a backend checkout, so only the LIKYLY team runs them.
- `@likyly/wizard`, published to npm from the backend repository.
