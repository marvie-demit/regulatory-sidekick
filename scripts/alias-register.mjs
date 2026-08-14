// Registers the "@/…" + extensionless resolve hook, so `node --import
// ./scripts/alias-register.mjs <script>` can import app modules directly.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hooks.mjs", pathToFileURL("./scripts/"));
