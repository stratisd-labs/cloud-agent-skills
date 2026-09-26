/**
 * Conventional Commits, enforced locally by the Husky `commit-msg` hook and
 * in CI by `.github/workflows/commitlint.yml`. See "Commits" in AGENTS.md.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Default is 100. 72 keeps subjects whole in `git log --oneline`.
    "header-max-length": [2, "always", 72]
  }
};
