# LIKYLY SDKs

Official clients for the [LIKYLY](https://likyly.com) recommendations API (`items`, `users`, `events`, `recommendations`, `placements`), each in its language's conventions.

| Language | Package | Directory | Docs |
|---|---|---|---|
| TypeScript / JavaScript | [`@likyly/sdk`](https://www.npmjs.com/package/@likyly/sdk) (npm) | [typescript](typescript) | [likyly.com/docs/sdk/typescript](https://likyly.com/docs/sdk/typescript) |
| React | [`@likyly/react`](https://www.npmjs.com/package/@likyly/react) (npm) | [react](react) | [README](react/README.md) |
| PHP | [`likyly/sdk`](https://packagist.org/packages/likyly/sdk) (Packagist) | [php](php) | [likyly.com/docs/sdk/php](https://likyly.com/docs/sdk/php) |
| Python | [`likyly`](https://pypi.org/project/likyly/) (PyPI) | [python](python) | [likyly.com/docs/sdk/python](https://likyly.com/docs/sdk/python) |
| Java | `com.likyly:likyly-sdk` (Maven Central) | [java](java) | [likyly.com/docs/sdk/java](https://likyly.com/docs/sdk/java) |
| .NET | [`Likyly`](https://www.nuget.org/packages/Likyly) (NuGet) | [dotnet](dotnet) | [likyly.com/docs/sdk/dotnet](https://likyly.com/docs/sdk/dotnet) |
| Go | `github.com/likyly/likyly-go` | [go](go) | [likyly.com/docs/sdk/go](https://likyly.com/docs/sdk/go) |
| Ruby | [`likyly`](https://rubygems.org/gems/likyly) (RubyGems) | [ruby](ruby) | [likyly.com/docs/sdk/ruby](https://likyly.com/docs/sdk/ruby) |
| Rust | [`likyly`](https://crates.io/crates/likyly) (crates.io) | [rust](rust) | [likyly.com/docs/sdk/rust](https://likyly.com/docs/sdk/rust) |
| MCP server | [`@likyly/mcp-server`](https://www.npmjs.com/package/@likyly/mcp-server) (npm) | [mcp](mcp) | [likyly.com/docs/mcp](https://likyly.com/docs/mcp) |

Method names per language: [docs/METHODS.md](docs/METHODS.md). No SDK for your language? The REST API is documented at [api.likyly.com/docs](https://api.likyly.com/docs).

## Repository layout

```
<language>/      one package per directory, with its own manifest, tests, examples, CHANGELOG and version
conformance/     scenarios.json (shared by every SDK's tests), openapi.json (copy of the API contract), scripts
docs/            generate.mjs: the READMEs, METHODS.md and the website data, from sdks.json + the examples
```

Two directories are also published as their own repository, because their registry reads the repository root:
`php/` → [Likyly/likyly-php](https://github.com/Likyly/likyly-php) (Packagist) and `go/` → [Likyly/likyly-go](https://github.com/Likyly/likyly-go) (Go modules).
Those mirrors are written by the release workflow only. Open issues and pull requests here.

## How it is kept correct

- **Contract**: `conformance/openapi.json` is a copy of `https://api.likyly.com/recsys-api/openapi.json`. A weekly job fails when they differ.
- **Shared scenarios** (`conformance/scenarios.json`): request/response scenarios, validated against the OpenAPI by `conformance/validate_against_openapi.py` and replayed by every SDK's test suite. Go reads its copy in `go/testdata/` (CI checks it is identical).
- **Behaviour tests** per SDK: validation, error mapping, retry rules (an event without `event_id` is never retried), encoding. They need no network and no API key.
- **Documentation is generated**: `node docs/generate.mjs` builds every language README and `docs/METHODS.md` from `docs/sdks.json` and the code samples in each `examples/quickstart*`. `--check` fails on drift (CI). With a `likyly-website` checkout next to this repository (or `--website <path>`), it also writes the website's SDK pages data.
- **Live tests** (LIKYLY team only): `conformance/local-api.sh start` runs the API from a checkout of the private backend (`LIKYLY_BACKEND`, default `../likyly-recsys`), then `source conformance/.local-api.env` and run an SDK's tests, or `conformance/run-examples.sh` for every quickstart.

## Versions and releases

Every package has its own version: fixing the Python SDK releases `likyly` for Python only.

1. Write commit messages as [Conventional Commits](https://www.conventionalcommits.org/): `fix: …` (patch), `feat: …` (minor), `feat!: …` (major). The package is the directory the commit touches.
2. On `main`, [release-please](https://github.com/googleapis/release-please) keeps one release pull request per changed package (version bump + CHANGELOG). Current versions: [.release-please-manifest.json](.release-please-manifest.json).
3. Merging a release pull request tags that package (`python-v1.2.1`) and starts [.github/workflows/release.yml](.github/workflows/release.yml): tests again, **waits for a manual approval**, then publishes to the registry.

| Registry | How the workflow authenticates |
|---|---|
| npm, PyPI, crates.io, RubyGems, NuGet | trusted publishing (OIDC): no stored token |
| Maven Central | Central Portal token + GPG key (secrets of the `publish-credentials` environment) |
| Packagist, Go | push to the mirror repository + tag `vX.Y.Z` (deploy keys) |

The setup of each registry, done once, is in [docs/RELEASING.md](docs/RELEASING.md).

## License

[MIT](LICENSE)
