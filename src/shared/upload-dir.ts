import { join } from 'path';

// Where listing images are written/served from. Mounted as a Docker volume in
// production so uploads survive container rebuilds.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
