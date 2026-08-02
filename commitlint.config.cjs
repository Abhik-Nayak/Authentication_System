module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Phases produce broad commits; 100 chars of subject is enough.
    'header-max-length': [2, 'always', 100],
  },
};
