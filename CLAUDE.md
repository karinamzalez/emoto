# Stuttgart — Emoto Project

## Tooling

- Dev server is pinned to port 9000 (`server.port: 9000, strictPort: true` in `vite.config.ts`; `baseURL: http://localhost:9000` in `playwright.config.ts`).

## Architecture

- **Ping-pong FBO pattern**: Two `WebGLRenderTarget`s (`fboA`, `fboB`) with a `readIdx` integer tracking which holds the latest output. Read from `readIdx === 0 ? fboA : fboB`; swap `readIdx` after each step.
- **`getDensityTexture` callback pattern**: Consumers of ping-pong FBOs accept a `getDensityTexture: () => THREE.Texture` callback rather than a static texture prop. Call it every frame inside `useFrame` so the reference always points to the current read target after a swap.
- **`onBeforeCompile` vertex displacement**: To displace vertices in `MeshPhysicalMaterial` using a CA/FBO texture, inject uniforms and GLSL via `material.onBeforeCompile`. Use `sign(objectNormal.z)` to distinguish front (+1), back (−1), and side (0) faces and apply displacement symmetrically along Z. Box geometry `THREE.BoxGeometry(2, 2, 0.3, N, N, 2)` gives N×N subdivisions on front/back with minimal side segments.

## Warnings

- **`gl.resetState()` before overlay renders**: When using `useFrame` with `priority=1` (which disables R3F's auto-render loop) and rendering a screen-space overlay quad, call `gl.resetState()` before the overlay's `renderer.render()` call. Without it, Three.js texture unit cache may be stale after the main scene render, causing blank/incorrect output.
- **`ShaderMaterial` GLSL version mismatch**: `glslVersion: THREE.GLSL3` combined with GLSL1 syntax (`varying`, `gl_FragColor`) silently produces "program not valid" WebGL errors and black output. Either omit `glslVersion` (defaults to GLSL1) or rewrite the shader in GLSL3 (`in`/`out`, `fragColor`). Set `toneMapped: false` for overlay materials to skip sRGB encoding.
- **Playwright WebGL pixel verification**: Playwright screenshots are dimmed by display color profile/gamma and are unreliable for exact WebGL pixel values. Use `gl.readPixels()` for ground-truth verification.
- **Playwright symmetry threshold**: Seed noise of ±0.001/cell sets the minimum achievable symmetry spread at ~0.002. Use `< 0.002` as the threshold, not `< 0.001`.
- **Playwright test isolation via query params**: Use `?droplet-off` (and similar flags) in test URLs to hide scene elements without touching production code paths. Check `App.tsx` for the canonical list of supported params.
- **Playwright rotation control**: The window hook `__emotoCrystalFreeze(angle: number | null)` lets tests pin or release mesh rotation. Pass a number to lock to a specific angle; pass `null` to resume animation.
