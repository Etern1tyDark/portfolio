// @ts-ignore - astro:content module
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Etern1ty'),
  }),
});

export const collections = { posts };
