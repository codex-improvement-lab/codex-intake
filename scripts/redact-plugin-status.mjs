import process from "node:process";

const kind = process.argv[2];
const targets = {
  marketplace: "codex-intake-local",
  plugin: "codex-intake"
};

if (!targets[kind]) {
  process.stderr.write("Usage: node scripts/redact-plugin-status.mjs <marketplace|plugin>\n");
  process.exitCode = 1;
} else {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  try {
    const parsed = JSON.parse(raw);
    const target = targets[kind];
    const matches = [];

    function visit(value) {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== "object") return;

      const safeIdentityValues = [
        value.name,
        value.plugin,
        value.plugin_name,
        value.pluginName,
        value.marketplace,
        value.marketplace_name,
        value.marketplaceName,
        value.selector
      ].filter((item) => typeof item === "string");

      if (safeIdentityValues.some((item) => item === target || item.startsWith(`${target}@`))) {
        const observation = {};
        for (const key of [
          "name",
          "plugin",
          "marketplace",
          "marketplace_name",
          "marketplaceName",
          "version",
          "installed",
          "enabled",
          "status"
        ]) {
          const item = value[key];
          if (["boolean", "number"].includes(typeof item)) observation[key] = item;
          else if (typeof item === "string") {
            const identityField = [
              "name",
              "plugin",
              "marketplace",
              "marketplace_name",
              "marketplaceName"
            ].includes(key);
            const safeIdentity = item === target || item === "codex-intake-local" || item === "codex-intake";
            const safeVersion = key === "version" && /^[0-9A-Za-z.+-]{1,48}$/.test(item);
            const safeStatus = key === "status" && /^[A-Za-z_-]{1,32}$/.test(item);
            if ((identityField && safeIdentity) || safeVersion || safeStatus) observation[key] = item;
          }
        }
        matches.push(observation);
      }

      Object.values(value).forEach(visit);
    }

    visit(parsed);
    const unique = [...new Map(matches.map((item) => [JSON.stringify(item), item])).values()];
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      kind: `codex-${kind}-status`,
      target,
      found: unique.length > 0,
      observations: unique,
      privacy: {
        sourcePathsIncluded: false,
        cachePathsIncluded: false,
        unrelatedPluginsIncluded: false
      }
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`plugin status redaction: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
