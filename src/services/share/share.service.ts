import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { ListingRepository } from '@infrastructure/listing.repository';
import { UPLOAD_DIR } from '@shared/upload-dir';
import { escapeHtml, frontendUrl } from '@shared/mail.service';

// The SPA's index.html is served by the udomi-frontend container; we fetch it
// once a minute and inject per-listing Open Graph tags so link previews
// (WhatsApp, Facebook, Viber...) show the animal. Browsers get the same page
// and boot the SPA normally.
const FRONTEND_INTERNAL_URL =
  process.env.FRONTEND_INTERNAL_URL || 'http://udomi-frontend';
const OG_DIR = join(UPLOAD_DIR, 'og');
const UUID = /^[0-9a-f-]{36}$/;

@Injectable()
export class ShareService {
  private indexCache: { html: string; at: number } | null = null;

  constructor(private readonly listingRepository: ListingRepository) {}

  private async indexHtml(): Promise<string> {
    if (this.indexCache && Date.now() - this.indexCache.at < 60_000)
      return this.indexCache.html;
    const res = await fetch(`${FRONTEND_INTERNAL_URL}/index.html`);
    if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`);
    this.indexCache = { html: await res.text(), at: Date.now() };
    return this.indexCache.html;
  }

  async listingPage(id: string): Promise<string> {
    const html = await this.indexHtml();
    if (!UUID.test(id)) return html;
    const listing = await this.listingRepository.findById(id, ['user']);
    if (!listing || listing.is_hidden || listing.user?.is_banned) return html;

    const image = [...(listing.images ?? [])].sort(
      (a, b) => a.position - b.position,
    )[0];
    const imageId = image && /\/([0-9a-f-]{36})\.webp$/.exec(image.url)?.[1];
    const description = (listing.description ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    const url = `${frontendUrl()}/animal/${listing.id}`;
    const title = `${listing.title} · Udomi me`;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="Udomi me" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(url)}" />`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<meta name="twitter:card" content="${imageId ? 'summary_large_image' : 'summary'}" />`,
      `<link rel="canonical" href="${escapeHtml(url)}" />`,
      ...(imageId
        ? [
            `<meta property="og:image" content="${frontendUrl()}/api/og/${imageId}.jpg" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
          ]
        : []),
    ].join('\n    ');

    return (
      html
        // Drop the site-wide defaults (marked data-default) and the generic title.
        .replace(/\s*<meta[^>]*data-default[^>]*>/g, '')
        .replace(
          /<title>[\s\S]*?<\/title>/,
          `<title>${escapeHtml(title)}</title>`,
        )
        .replace('</head>', `    ${tags}\n  </head>`)
    );
  }

  // 1200x630 JPEG for link previews (not every app renders WebP). Whole photo
  // over a blurred fill, like the in-app carousel. Generated once, cached.
  async ogImage(id: string): Promise<string> {
    if (!UUID.test(id)) throw new NotFoundException();
    const out = join(OG_DIR, `${id}.jpg`);
    if (existsSync(out)) return out;
    const src = join(UPLOAD_DIR, `${id}.webp`);
    if (!existsSync(src)) throw new NotFoundException();

    await mkdir(OG_DIR, { recursive: true });
    const background = await sharp(src)
      .resize(1200, 630, { fit: 'cover' })
      .blur(40)
      .modulate({ brightness: 0.8 })
      .toBuffer();
    const foreground = await sharp(src)
      .resize(1200, 630, { fit: 'inside' })
      .toBuffer();
    await sharp(background)
      .composite([{ input: foreground, gravity: 'center' }])
      .jpeg({ quality: 82 })
      .toFile(out);
    return out;
  }
}
