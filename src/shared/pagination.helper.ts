import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

export interface Pagination {
  page: number;
  limit: number;
}

export const PaginationParams = createParamDecorator(
  (data, ctx: ExecutionContext): Pagination => {
    const req: Request = ctx.switchToHttp().getRequest();
    const page = parseInt(req.query.page as string);
    const limit = parseInt(req.query.limit as string);

    if (!req.query.page || !req.query.limit) {
      throw new BadRequestException('Missing pagination params');
    }

    if (isNaN(page) || page < 0 || isNaN(limit) || limit < 0) {
      throw new BadRequestException('Invalid pagination params');
    }

    return { page, limit };
  },
);
