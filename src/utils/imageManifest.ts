import type { ImageMetadata } from 'astro';

const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/**/*.{avif,gif,jpeg,jpg,png,svg,webp}',
  { eager: true },
);

const imageManifest = Object.fromEntries(
  Object.entries(imageModules).map(([path, mod]) => [path.replace('../assets/images', '/images'), mod.default]),
) as Record<string, ImageMetadata>;

export const resolveImageAsset = (path: string): ImageMetadata | string => {
  if (!path.startsWith('/')) return path;

  const asset = imageManifest[path];
  if (!asset) {
    throw new Error(`Image asset not found for path "${path}". Add it under src/assets/images.`);
  }
  return asset;
};
