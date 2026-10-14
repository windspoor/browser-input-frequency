# Publish as a separate GitHub repository

This release is already published at
[windspoor/browser-input-frequency](https://github.com/windspoor/browser-input-frequency),
with [GitHub Pages](https://windspoor.github.io/browser-input-frequency/) enabled.
The instructions below are for publishing your own copy.

Run every command **inside this companion directory**, never inside the main
mousepollingratetest site repository. No production deployment is required.

Authenticate GitHub CLI and confirm which account will own the repository:

```sh
gh auth login --hostname github.com
gh api user --jq .login
```

Initialize a new repository if this directory does not already have its own `.git`:

```sh
git init -b main
git add .
git commit -m "Add browser mouse input frequency experiment"
gh repo create browser-input-frequency --public --source . --remote origin --push --description "Compare mousemove, pointermove and pointerrawupdate with coalesced samples" --homepage https://mousepollingratetest.com/
```

If the repository already exists, inspect it before choosing a different name or
pushing; do not overwrite an unrelated repository.

Optional repository topics:

```sh
gh repo edit --add-topic mouse-polling-rate --add-topic pointer-events --add-topic javascript --add-topic mousemove --add-topic pointerrawupdate
```

The homepage points to the full online tool. To add a runnable hosted demo, enable
GitHub Pages in this new repository's Settings → Pages, select **Deploy from a
branch**, and choose **main / root**. The relative asset URLs work under a Pages
repository path. Pages publishing is independent of the production site.

Only project source, documentation, tests, the blank validation ledger and CI are
needed. Do not commit local artifacts, credentials or dependency directories.
