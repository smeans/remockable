# Publishing remockable to npm

## Publishing steps

1. Create an account at [npmjs.com](https://www.npmjs.com/signup) and verify your email (required to publish).
2. Log in from the terminal:
   ```sh
   npm login
   ```
   Confirm with `npm whoami`.
3. (Recommended) Enable 2FA on your npm account and require an OTP for publishes.
4. Preview exactly what will be shipped — no upload happens:
   ```sh
   npm publish --dry-run
   ```
   Verify the file list contains only `bin/`, `src/`, `README.md`, `LICENSE`, and `package.json`.
5. Publish the package:
   ```sh
   npm publish
   ```
   For a scoped name (e.g. `@you/remockable`), the first publish needs:
   ```sh
   npm publish --access public
   ```
6. Verify the release:
   ```sh
   npm view remockable
   npx remockable
   ```

## Version updates

Use `npm version` to bump the version and create a git tag in one step, then publish:

```sh
npm version patch   # or: minor / major
npm publish
git push --follow-tags
```

Follows [semantic versioning](https://semver.org/): `patch` for fixes, `minor` for new backward-compatible features, `major` for breaking changes.

## Local testing

Try the command globally before publishing:

```sh
npm link            # symlink the `remockable` command
remockable    # run it from anywhere
npm unlink -g remockable   # undo when done
```
