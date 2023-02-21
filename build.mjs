import * as esbuild from 'esbuild';
const production = process.argv[2] === "--production";

await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outdir: "./dist",
    external: ["vscode"],
    format: "cjs",
    sourcemap: !production,
    minify: production,
    platform: "node",
    // target: ["ES2021"],
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
