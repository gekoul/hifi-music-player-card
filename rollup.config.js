import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
import terser from '@rollup/plugin-terser';

const dev = process.env.ROLLUP_WATCH;
export default {
  input: 'src/hifi-music-player-card.ts',
  output: { file: 'dist/hifi-music-player-card.js', format: 'es', sourcemap: false, inlineDynamicImports: true },
  plugins: [replace({ preventAssignment: true, values: { __VERSION__: JSON.stringify(pkg.version) } }), resolve(), json(), typescript({ outDir: "dist", noEmit: false, declaration: false }), !dev && terser({ format: { comments: false } })],
};
