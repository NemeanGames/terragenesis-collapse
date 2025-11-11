module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  plugins: ["react-refresh", "@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  rules: {
    "react-refresh/only-export-components": "warn",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
};
