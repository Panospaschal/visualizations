import { build, context } from "esbuild"
import { mkdir, copyFile } from "node:fs/promises"
import { resolve } from "node:path"

const isWatch = process.argv.includes("--watch")
const outdir = resolve(process.cwd(), "dist")

const buildTargets = [
  {
    entryPoint: "src/acme_bar_plus.js",
    outfile: "dist/acme_bar_plus.js"
  },
  {
    entryPoint: "src/report_table_panos.js",
    outfile: "dist/report_table.js"
  }
]

const baseBuildOptions = {
  bundle: true,
  minify: true,
  target: ["es2019"],
  format: "iife",
  logLevel: "info"
}

function buildOptionsFor(target) {
  return {
    ...baseBuildOptions,
    entryPoints: [target.entryPoint],
    outfile: target.outfile
  }
}

await mkdir(outdir, { recursive: true })
await copyFile("src/acme_bar_plus.css", "dist/acme_bar_plus.css")

if (isWatch) {
  const contexts = await Promise.all(
    buildTargets.map((target) => context(buildOptionsFor(target)))
  )
  await Promise.all(contexts.map((ctx) => ctx.watch()))
  console.log("Watching for changes...")
  await new Promise(() => {})
} else {
  await Promise.all(buildTargets.map((target) => build(buildOptionsFor(target))))
}
