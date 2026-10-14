import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const candidatePaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];

export function loadDotenv(): void {
  for (const path of candidatePaths) {
    if (existsSync(path)) {
      dotenv.config({ path });
    }
  }
}
