# Stuttgart — Emoto Project

## Tooling

- Dev server is pinned to port 9000 (`server.port: 9000, strictPort: true` in `vite.config.ts`; `baseURL: http://localhost:9000` in `playwright.config.ts`).

## Architecture

- **Ping-pong FBO pattern**: Two `WebGLRenderTarget`s (`fboA`, `fboB`) with a `readIdx` integer tracking which holds the latest output. Read from `readIdx === 0 ? fboA : fboB`; swap `readIdx` after each step.
- **`getDensityTexture` callback pattern**: Consumers of ping-pong FBOs accept a `getDensityTexture: () => THREE.Texture` callback rather than a static texture prop. Call it every frame inside `useFrame` so the reference always points to the current read target after a swap.
- **`onBeforeCompile` vertex displacement**: To displace vertices in `MeshPhysicalMaterial` using a CA/FBO texture, inject uniforms and GLSL via `material.onBeforeCompile`. Use `sign(objectNormal.z)` to distinguish front (+1), back (−1), and side (0) faces and apply displacement symmetrically along Z. Box geometry `THREE.BoxGeometry(2, 2, 0.3, N, N, 2)` gives N×N subdivisions on front/back with minimal side segments.
- **`Crystal` crossfade wrapper**: `<Crystal>` owns crystallinity state and drives `Droplet` and `CrystalMesh` via `opacityOverride` props. `crossfadeWeights(c)` (`src/lib/crossfadeWeights.ts`) returns `{ droplet, crystal }` using `smoothstep(0.3, 0.7, c)` so weights always sum to 1. A `scaleY = 1 - 0.15 * c` tween on the parent group sells the droplet-to-plate transition. Priority chain for any Playwright-controllable value: window hook override > external prop > Leva panel.

## Warnings

- **`gl.resetState()` before overlay renders**: When using `useFrame` with `priority=1` (which disables R3F's auto-render loop) and rendering a screen-space overlay quad, call `gl.resetState()` before the overlay's `renderer.render()` call. Without it, Three.js texture unit cache may be stale after the main scene render, causing blank/incorrect output.
- **`ShaderMaterial` GLSL version mismatch**: `glslVersion: THREE.GLSL3` combined with GLSL1 syntax (`varying`, `gl_FragColor`) silently produces "program not valid" WebGL errors and black output. Either omit `glslVersion` (defaults to GLSL1) or rewrite the shader in GLSL3 (`in`/`out`, `fragColor`). Set `toneMapped: false` for overlay materials to skip sRGB encoding.
- **Playwright WebGL pixel verification**: Playwright screenshots are dimmed by display color profile/gamma and are unreliable for exact WebGL pixel values. Use `gl.readPixels()` for ground-truth verification.
- **Playwright symmetry threshold**: Seed noise of ±0.001/cell sets the minimum achievable symmetry spread at ~0.002. Use `< 0.002` as the threshold, not `< 0.001`.
- **Playwright test isolation via query params**: Use `?droplet-off` (and similar flags) in test URLs to hide scene elements without touching production code paths. Check `App.tsx` for the canonical list of supported params.
- **Playwright window hooks**: `__emotoCrystalFreeze(angle: number | null)` pins/releases mesh rotation (number = lock to angle, `null` = resume). `__emotoCrossfade(value: number | null)` overrides crystallinity for crossfade tests (same null-to-release semantics).
- **Transmissive material opacity in `useFrame`**: Setting `opacity` on a `MeshPhysicalMaterial` with `transmission > 0` requires `transparent: true`. Only set `material.needsUpdate = true` when the `transparent` flag itself changes, not every frame, to avoid per-frame shader recompilation.
