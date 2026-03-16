import { build, context } from "esbuild"
import { mkdir, copyFile } from "node:fs/promises"
import { resolve } from "node:path"

const isWatch = process.argv.includes("--watch")
const outdir = resolve(process.cwd(), "dist")

const buildOptions = {
  entryPoints: ["src/acme_bar_plus.js"],
  outfile: "dist/acme_bar_plus.js",
  bundle: true,
  minify: true,
  target: ["es2019"],
  format: "iife",
  logLevel: "info"
}

await mkdir(outdir, { recursive: true })
await copyFile("src/acme_bar_plus.css", "dist/acme_bar_plus.css")

if (isWatch) {
  const ctx = await context(buildOptions)
  await ctx.watch()
  console.log("Watching for changes...")
  await new Promise(() => {})
} else {
  await build(buildOptions)
}
