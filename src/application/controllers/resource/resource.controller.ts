import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { Cookies } from '@shared/cookie.helper';
import { Throttle } from '@nestjs/throttler';
import { UserService } from '@services/user/user.service';
import { UPLOAD_DIR } from '@shared/upload-dir';

// Listing images, stored on local disk (UPLOAD_DIR, a Docker volume in
// production) and served by main.ts at /api/uploads/*. Every upload is
// re-encoded to WebP, max 1600px — phone photos are 5-10MB otherwise.
@Controller('/upload')
export class ResourceController {
  constructor(private readonly userService: UserService) {}

  @Post('/')
  @Throttle({ default: { limit: 60, ttl: 10 * 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        cb(null, file.mimetype.startsWith('image/')),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Cookies('token') token: string,
  ) {
    await this.userService.getMe(token, []);
    if (!file) throw new BadRequestException('An image file is required');

    const id = uuidv4();
    try {
      await sharp(file.buffer)
        .rotate() // apply EXIF orientation before it's stripped
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(join(UPLOAD_DIR, `${id}.webp`));
    } catch {
      throw new BadRequestException('Unsupported or corrupt image');
    }

    return { url: `/api/uploads/${id}.webp`, id };
  }
}
