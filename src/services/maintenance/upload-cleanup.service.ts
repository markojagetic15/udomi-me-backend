import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { AppDataSource } from '@config/data-source';
import { UPLOAD_DIR } from '@shared/upload-dir';

const DAY = 24 * 60 * 60 * 1000;

// Photos are uploaded before the listing is saved, so abandoned forms leave
// orphans. Once a day, delete uploads older than 24h that no listing or avatar
// references (plus link-preview JPEGs whose source photo is gone).
@Injectable()
export class UploadCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    setTimeout(() => this.run(), 60_000).unref();
    this.timer = setInterval(() => this.run(), DAY);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    try {
      const rows: { url: string }[] = await AppDataSource.query(`
        SELECT img->>'url' AS url FROM listings, json_array_elements(COALESCE(images, '[]'::json)) img
        UNION SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL`);
      const referenced = new Set(rows.map((r) => r.url?.split('/').pop()));
      let removed = 0;
      for (const f of await readdir(UPLOAD_DIR)) {
        if (!/^[0-9a-f-]{36}\.webp$/.test(f) || referenced.has(f)) continue;
        const path = join(UPLOAD_DIR, f);
        if (Date.now() - (await stat(path)).mtimeMs < DAY) continue;
        await unlink(path);
        await unlink(join(UPLOAD_DIR, 'og', f.replace('.webp', '.jpg'))).catch(
          () => undefined,
        );
        removed++;
      }
      if (removed)
        console.log(`Upload cleanup: removed ${removed} orphaned file(s)`);
    } catch (e) {
      console.error('Upload cleanup failed:', e);
    }
  }
}
