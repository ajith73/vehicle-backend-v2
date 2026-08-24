import { Request, Response } from 'express';
import { Mechanic } from '../models';

export const getSitemap = async (req: Request, res: Response) => {
  try {
    const mechanics = await Mechanic.findAll({
      where: { status: 'Approved' },
      attributes: ['id', 'updatedAt']
    });

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://roadresq.in/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://roadresq.in/map</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://roadresq.in/list</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

    // Dynamic Mechanic URLs (Assuming we will have mechanic profiles or they are queried via map/list)
    mechanics.forEach((mechanic: any) => {
      sitemap += `
  <url>
    <loc>https://roadresq.in/mechanic/${mechanic.id}</loc>
    <lastmod>${mechanic.updatedAt ? new Date(mechanic.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemap += `\n</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};
