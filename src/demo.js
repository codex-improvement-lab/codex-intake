export const DEMO_AUTH_FIXTURE = "example_redact_me";

export const DEMO_SOURCES = [
  {
    name: "checkout-notes.txt",
    kind: "text",
    content: `Checkout export crashes after redaction
Need the Markdown export to work with Windows paths and keep every source link.
Expected: a downloaded brief includes testable done-when and never exposes the token.
Reporter: dev@example.com`
  },
  {
    name: "checkout-export.log",
    kind: "log",
    content: `pnpm test -- checkout-export
ERROR TypeError: Cannot read properties of undefined (reading 'locator')
    at renderPointer (C:\\Users\\alex\\codex-intake\\src\\core\\export.js:42:18)
Authorization: Bearer ${DEMO_AUTH_FIXTURE}`
  },
  {
    name: "affected-files.files",
    kind: "file-list",
    content: `file src/core/export.js
file src/ui/download.js
file tests/export.test.js`
  }
];
