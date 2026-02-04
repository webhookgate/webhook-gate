import crypto from "crypto";
import { insertApiKey } from "../src/db.js";

function randId(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

const label = process.argv[2] || "manual";
const plan = process.argv[3] || "starter";

const apiKeyPlain = randId("wgk");
const id = randId("key");
const keyHash = sha256(apiKeyPlain);

insertApiKey({ id, keyHash, label, plan });

console.log("Created API key:");
console.log(apiKeyPlain);
console.log("");
console.log("Store this plaintext key now. It cannot be recovered later.");
