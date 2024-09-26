import { Injectable, UploadedFiles } from '@nestjs/common';

@Injectable()
export class ResourceService {
  async uploadImage(@UploadedFiles() files: Express.MulterS3.File[]) {
    if (!files || files.length === 0) {
      return { message: 'No files uploaded' };
    }

    const images = files.map((file) => {
      return {
        url: file.location,
        id: file.key,
      };
    });

    return { images };
  }
}
