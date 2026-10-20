import { execSync } from "node:child_process";

// Create a fresh, isolated SQLite database (prisma/test.db) for the test run.
export default function setup() {
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
