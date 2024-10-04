import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ResourceService } from '@/services/resource/resource.service';
import { upload } from '@/shared/upload';

@Controller('/resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post('/')
  @UseInterceptors(FilesInterceptor('images', 5, upload))
  async uploadImage(@UploadedFiles() files: Express.MulterS3.File[]) {
    return this.resourceService.uploadImage(files);
  }
}
