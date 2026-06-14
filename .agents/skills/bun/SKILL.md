---
name: Bun
description: Use when building JavaScript/TypeScript applications, running scripts, managing dependencies, bundling code, or testing. Bun is an all-in-one toolkit that replaces Node.js, npm, webpack, and Jest with a single fast binary.
metadata:
    mintlify-proj: bun
    version: "1.0"
---

# Bun Skill

## Product summary

Bun is an all-in-one JavaScript/TypeScript toolkit that ships as a single executable. It includes a runtime (drop-in Node.js replacement), package manager (faster than npm), bundler (faster than esbuild), and test runner (Jest-compatible). The runtime uses JavaScriptCore and is written in Zig, delivering 4x faster startup than Node.js.

**Key files and commands:**
- `bunfig.toml` — Configuration file (optional, zero-config by default)
- `bun run <file>` — Execute JavaScript/TypeScript files with native transpilation
- `bun install` — Install dependencies 25x faster than npm
- `bun build <entry>` — Bundle for browser or server
- `bun test` — Run Jest-compatible tests
- `package.json` — Standard Node.js package manifest (fully compatible)

**Primary docs:** https://bun.com/docs

---

## When to use

Reach for this skill when:

- **Running scripts or servers** — `bun run` is 28x faster than `npm run`; use for any TypeScript/JSX execution
- **Installing dependencies** — `bun install` is 25x faster; works in existing Node.js projects
- **Bundling for production** — `bun build` bundles JS/TS/JSX/CSS for browsers or servers; 1.75x faster than esbuild
- **Testing** — `bun test` runs Jest-compatible tests with TypeScript support, snapshots, mocking, and watch mode
- **Building full-stack apps** — HTML imports + `Bun.serve` enable bundling frontend and backend in one command
- **Migrating from Node.js** — Bun is a drop-in replacement; most Node.js code works without changes
- **Optimizing startup time** — Bun's transpiler and runtime eliminate overhead; ideal for CLI tools and serverless functions

---

## Quick reference

### Essential commands

| Command | Purpose |
|---------|---------|
| `bun run <file>` | Execute JS/TS/JSX/TSX file |
| `bun run <script>` | Run package.json script |
| `bun install` | Install all dependencies |
| `bun add <pkg>` | Add a package |
| `bun remove <pkg>` | Remove a package |
| `bun build <entry> --outdir ./out` | Bundle for production |
| `bun test` | Run all tests |
| `bun init` | Create new Bun project |

### File conventions

| Pattern | Behavior |
|---------|----------|
| `*.test.ts`, `*.test.js` | Test files (auto-discovered) |
| `*_test.ts`, `*.spec.ts` | Alternative test patterns |
| `bunfig.toml` | Configuration (optional) |
| `bun.lock` | Lockfile (text format, commit to version control) |
| `.env` | Environment variables (auto-loaded) |

### Configuration in bunfig.toml

```toml
# Runtime
[run]
shell = "bun"  # or "system"
bun = true     # alias node to bun in scripts

# Package manager
[install]
linker = "hoisted"  # or "isolated" for monorepos
dev = true
optional = true
production = false

# Test runner
[test]
root = "."
coverage = false
timeout = 5000

# Server
[serve]
port = 3000
```

### Common procedures

**Initialize a project:**
```bash
bun init my-app
cd my-app
bun run index.ts
```

**Add a dependency:**
```bash
bun add react
bun add -d typescript  # dev dependency
```

**Run a script from package.json:**
```bash
bun run dev
bun run build
```

**Bundle for production:**
```bash
bun build ./src/index.tsx --outdir ./dist --minify
```

**Run tests with coverage:**
```bash
bun test --coverage
```

**Create an HTTP server:**
```typescript
const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () => new Response("Hello"),
    "/api/users/:id": (req) => new Response(`User ${req.params.id}`),
  },
});
console.log(`Server at ${server.url}`);
```

---

## Decision guidance

### When to use `bun run` vs `bun build`

| Use `bun run` | Use `bun build` |
|---------------|-----------------|
| Development, scripts, one-off execution | Production bundles, browser code, optimization |
| Direct file execution with transpilation | Minification, tree-shaking, code splitting |
| Testing, debugging, local development | Deployment, distribution, performance-critical |

### When to use `hoisted` vs `isolated` linker

| Hoisted | Isolated |
|---------|----------|
| Traditional npm behavior, flat node_modules | Strict dependency isolation, prevents phantom deps |
| Single-package projects (default) | Monorepos, workspaces (default) |
| Faster installs, simpler resolution | Stricter, more predictable, pnpm-like |

### When to use `Bun.serve` vs framework

| Bun.serve | Framework (Express, Elysia, Hono) |
|-----------|-----------------------------------|
| Simple APIs, minimal dependencies | Complex routing, middleware, plugins |
| Maximum performance, zero overhead | Developer experience, ecosystem |
| Built-in routing, WebSocket, streaming | Type safety, validation, decorators |

### When to use `bun test` vs external test runner

| bun test | Jest/Vitest |
|----------|-------------|
| TypeScript out of box, no config | Mature ecosystem, more plugins |
| Fast, Jest-compatible API | Better IDE integration in some cases |
| Built-in mocking, snapshots, watch | More customization options |

---

## Workflow

### Typical task: Build and deploy a full-stack app

1. **Initialize project**
   ```bash
   bun init my-app
   cd my-app
   ```

2. **Create server code** (`server.ts`)
   ```typescript
   import index from "./index.html";
   
   Bun.serve({
     routes: {
       "/": index,
       "/api/data": () => Response.json({ data: [] }),
     },
   });
   ```

3. **Create frontend** (`index.html` with React/TypeScript)
   ```html
   <!DOCTYPE html>
   <html>
     <head><title>App</title></head>
     <body>
       <div id="root"></div>
       <script type="module" src="./client.tsx"></script>
     </body>
   </html>
   ```

4. **Install dependencies**
   ```bash
   bun add react react-dom
   bun add -d @types/bun
   ```

5. **Test locally**
   ```bash
   bun run server.ts
   # Visit http://localhost:3000
   ```

6. **Build for production**
   ```bash
   bun build ./server.ts --target bun --outfile ./dist/server
   ```

7. **Deploy** (e.g., to Vercel, Railway, or Docker)
   ```bash
   # Dockerfile
   FROM oven/bun
   COPY . /app
   WORKDIR /app
   RUN bun install
   CMD ["bun", "run", "server.ts"]
   ```

### Typical task: Add tests to existing project

1. **Create test file** (`math.test.ts`)
   ```typescript
   import { test, expect } from "bun:test";
   
   test("addition", () => {
     expect(2 + 2).toBe(4);
   });
   ```

2. **Run tests**
   ```bash
   bun test
   ```

3. **Add coverage**
   ```bash
   bun test --coverage
   ```

4. **Watch mode**
   ```bash
   bun test --watch
   ```

### Typical task: Migrate from npm to Bun

1. **Check compatibility** — Most Node.js projects work as-is
2. **Replace npm with bun**
   ```bash
   rm -rf node_modules package-lock.json
   bun install  # Creates bun.lock
   ```

3. **Update CI/CD** — Replace `npm install` with `bun install`, `npm run` with `bun run`
4. **Test thoroughly** — Run your test suite with `bun test`
5. **Commit lockfile** — `bun.lock` should be committed to version control

---

## Common gotchas

- **TypeScript errors on `Bun` global** — Install `@types/bun` and configure `tsconfig.json` with `"lib": ["ESNext"]`
- **Lifecycle scripts disabled by default** — Add trusted packages to `trustedDependencies` in `package.json` to allow postinstall scripts
- **Auto-install can mask missing dependencies** — Use `--frozen-lockfile` in CI to catch mismatches
- **Bundler always bundles** — Use `Bun.Transpiler` if you need per-file transpilation without bundling
- **`bun run` flags must come after `bun`, not after script name** — `bun --watch run dev` ✓, `bun run dev --watch` ✗
- **Environment variables not inlined by default** — Use `env: "inline"` in `bun build` or `--env inline` CLI flag
- **Monorepo linker defaults differ** — New workspaces use `isolated`, existing projects use `hoisted`; explicitly set in `bunfig.toml` to avoid surprises
- **Node.js compatibility is ongoing** — Check `/runtime/nodejs-compat` for unsupported APIs; some Node.js modules may not work
- **Bun.serve routes are static** — Use `fetch()` handler for dynamic routing; `routes` object is for static paths and parameters
- **Test discovery is automatic** — No need to specify test files; `bun test` finds all `*.test.ts` files recursively

---

## Verification checklist

Before submitting work with Bun:

- [ ] **Dependencies installed** — Run `bun install` and verify `bun.lock` is created
- [ ] **Code runs locally** — `bun run <entry>` executes without errors
- [ ] **Tests pass** — `bun test` shows all tests passing
- [ ] **TypeScript compiles** — No type errors in editor or from `bun check` (if available)
- [ ] **Bundler output valid** — `bun build` completes without errors; output files exist
- [ ] **Environment variables set** — `.env` file exists or CI/CD has required vars
- [ ] **Lockfile committed** — `bun.lock` is in version control (not `.gitignore`d)
- [ ] **No Node.js-specific APIs** — If targeting Bun, avoid unsupported Node.js modules
- [ ] **Trusted dependencies declared** — If using postinstall scripts, add to `trustedDependencies`
- [ ] **Performance verified** — For production, confirm bundle size and startup time are acceptable

---

## Resources

**Comprehensive navigation:** https://bun.com/docs/llms.txt

**Critical pages:**
- [Runtime overview](https://bun.com/docs/runtime) — Execute files, run scripts, environment
- [Package manager](https://bun.com/docs/pm/cli/install) — Install, add, remove, workspaces
- [Bundler](https://bun.com/docs/bundler) — Build for browser and server, code splitting, plugins
- [Test runner](https://bun.com/docs/test) — Write tests, mocking, snapshots, coverage
- [HTTP server](https://bun.com/docs/runtime/http/server) — Bun.serve, routing, WebSocket, TLS

---

> For additional documentation and navigation, see: https://bun.com/docs/llms.txt