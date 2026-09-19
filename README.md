# QuickSign

QuickSign is a browser app for practicing American Sign Language with webcam-based feedback.
Recognition runs on the user's device. The production application is in `web/`.

**Start here:** [current project brief](docs/AI_ONBOARDING.md) ·
[contributor instructions](AGENTS.md) · [live app](https://quicksignn.vercel.app)

## Run the app

Use Node **22.12 or newer** (see `web/package.json`).

```sh
cd web
npm ci
npm run dev
```

See [web setup and tests](web/README.md) for environment variables, Supabase and browser tests.
Local UI development works without a configured Supabase project.

## Find the right reference

| Task | Reference |
|---|---|
| Understand the shipped app | [Architecture](ARCHITECTURE.md) |
| Fix recognition or add a sign | [Recognition rules](AGENTS.md#recognition-rules--binding) |
| Deploy or roll back | [Deployment](DEPLOYMENT.md) |
| Work on analytics | [Analytics developer guide](docs/analytics/DEVELOPER_GUIDE.md) |
| Use Python calibration/training tools | [Python prototype](docs/PYTHON_PROTOTYPE.md), [ML pipeline](ml/README.md) |
| Trace an old decision | [History index](docs/vault/00-Index.md), [archived reports](docs/archive/README.md) |

Animation replacement is deferred. Existing demo clips and automated recognition checks must
not be presented as expert certification of ASL accuracy; see [validation](docs/ASL_VALIDATION_PROGRAM.md)
and [licensing](docs/LICENSING_CHECKLIST.md).
