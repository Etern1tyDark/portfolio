import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import astroIcon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypePrefixBase from './src/utils/rehypePrefixBase.mjs';

const site = process.env.SITE_URL ?? 'https://etern1ty.site';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'tokyo-night',
    },
  },
  integrations: [
    tailwind({
      config: './tailwind.config.mjs',
    }),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, [rehypePrefixBase, { base }]],
    }),
    sitemap(),
    astroIcon(),
  ],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
    domains: ['cdn.jsdelivr.net', 'images.unsplash.com', 'raw.githubusercontent.com'],
  },
  vite: {
    optimizeDeps: {
      include: ['gsap'],
    },
  },
  site,
  base,
});
