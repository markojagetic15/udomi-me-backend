import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { ShareService } from '@services/share/share.service';

// nginx rewrites /animal/:id here (see nginx/conf.d/udomi.conf) so link
// previews get per-listing Open Graph tags.
@Controller()
@SkipThrottle()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('/share/animal/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  listingPage(@Param('id') id: string) {
    return this.shareService.listingPage(id);
  }

  @Get('/og/:file')
  async ogImage(@Param('file') file: string, @Res() res: Response) {
    const path = await this.shareService.ogImage(file.replace(/\.jpg$/, ''));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path);
  }
}
