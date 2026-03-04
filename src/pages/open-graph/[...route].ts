import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const posts = await getCollection('posts');

const pages = {
  index: {
    title: '~/eter',
    description: 'eter\'s space',
  },
  about: {
    title: '~/eter/about',
    description: 'About eter - Nathan Kho Pancras',
  },
  experience: {
    title: '~/eter/experience',
    description: 'Experience, awards, and projects.',
  },
  blog: {
    title: '~/eter/blog',
    description: 'eter\'s personal blogs.',
  },
  ...Object.fromEntries(
    posts.map((post) => [
      `blog/${post.slug}`,
      {
        title: post.data.title,
        description: post.data.description,
      },
    ]),
  ),
};

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (path, page) => ({
    title: page.title,
    description: page.description,
    logo: {
      path: './src/assets/images/logo.jpg',
      size: [200],
    },
    fonts: ['./src/assets/fonts/DejaVuSans.ttf', './src/assets/fonts/DejaVuSans-Bold.ttf'],
    bgGradient: path.startsWith('blog/')
      ? [
          [15, 23, 42],
          [29, 35, 56],
        ]
      : [
          [26, 27, 38],
          [36, 40, 59],
        ],
    border: {
      color: [122, 162, 247],
      width: 12,
    },
    font: {
      title: {
        color: [192, 202, 245],
        size: 66,
        weight: 'Bold',
      },
      description: {
        color: [169, 177, 214],
        size: 34,
      },
    },
  }),
});
