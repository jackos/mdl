import * as esbuild from 'esbuild';

let ctx2 = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outdir: "./dist",
    format: "cjs",
    sourcemap: true,
    minify: false,
    platform: "node",
    target: ["ES2021"],
    external: ["vscode"],
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

  await ctx2.watch();
  console.log("watching for changes...");
