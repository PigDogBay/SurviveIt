import { defineConfig } from 'vite';

// Relative asset paths, so the built game works from any folder, such as
// itch.io, which serves each game from its own sub-folder.
export default defineConfig({
  base: './',
});
