# Renovate Configuration

This project uses [Renovate](https://docs.renovatebot.com/) for automated dependency management.

## What Renovate Does

- **Automatically creates PRs** for dependency updates
- **Groups related packages** (ESLint, testing, types) together
- **Auto-merges safe updates** (patches, dev dependencies)
- **Provides security alerts** for vulnerable dependencies
- **Maintains lock files** weekly

## Configuration Highlights

### Auto-merge Rules

- ✅ **Patch updates** for most dependencies
- ✅ **Type definitions** (@types/\*)
- ✅ **Dev dependencies** (minor/patch)
- ❌ **Major updates** for critical packages (Next.js, React, TypeScript)

### Grouped Updates

- **ESLint packages** → Single PR
- **Testing packages** → Single PR
- **OpenTelemetry packages** → Single PR
- **Type definitions** → Single PR

### Critical Package Handling

These packages get separate PRs for major/minor updates:

- `next`, `react`, `react-dom`
- `typescript`
- `@auth0/nextjs-auth0`
- `@sentry/nextjs`

### Schedule

- **Dependency updates**: Mondays before 9 AM Pacific/Auckland
- **Lock file maintenance**: Mondays before 6 AM Pacific/Auckland
- **Security updates**: Immediate

## Manual Controls

### Trigger Renovate Manually

```bash
# Via GitHub Actions (if you have workflow permissions)
gh workflow run renovate.yml
```

### Pause Renovate

Add to any PR description:

```
renovate-approve: false
```

### Skip Specific Dependencies

Add to `renovate.json`:

```json
{
  "ignoreDeps": ["package-name"]
}
```

## Monitoring

- **Dependency Dashboard**: Renovate creates an issue tracking all updates
- **Security Alerts**: Immediate PRs for vulnerable dependencies
- **Labels**: All PRs tagged with `dependencies`, security PRs get `security`

## Getting Started

1. **Enable Renovate** on your GitHub repository
2. **Grant permissions** for Renovate to create PRs
3. **First run** will create the dependency dashboard issue
4. **Review configuration** in `renovate.json` and adjust as needed

## Troubleshooting

### No PRs Created

- Check Renovate logs in GitHub Actions
- Verify repository permissions
- Ensure `renovate.json` is valid JSON

### Too Many PRs

- Adjust `prConcurrentLimit` in `renovate.json`
- Add more packages to `ignoreDeps`
- Modify grouping rules

### Failed Auto-merge

- Check if CI/CD pipeline passes
- Verify auto-merge settings in GitHub repository
- Review PR for conflicts

For more information, see the [Renovate documentation](https://docs.renovatebot.com/).
