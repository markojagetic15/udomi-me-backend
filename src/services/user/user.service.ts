import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import {
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UpdateUserDto } from '@application/dto/user/update-user.dto';
import { JwtAuthGuard } from '@shared/auth.guard';
import { UserRepository } from '@infrastructure/user.repository';
import { Pagination } from '@shared/pagination.helper';
import { ListingRepository } from '@infrastructure/listing.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly listingRepository: ListingRepository,
  ) {}

  @UseGuards(JwtAuthGuard)
  async getMe(@Headers() headers: { authorization: string }) {
    const header = headers.authorization;

    if (!header) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const token = header.split(' ')[1];

    if (!token) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const decode = jwt.decode(token);

    if (!decode) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.userRepository.findById((decode as JwtPayload).id, [
      'listings',
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Headers() headers: { authorization: string },
  ) {
    const { user: me } = await this.getMe(headers);

    if (me.id !== id) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, body);
    await this.userRepository.save(user);

    return { user };
  }

  @UseGuards(JwtAuthGuard)
  async deleteUser(
    @Param('id') id: string,
    @Headers() headers: { authorization: string },
  ) {
    const { user: me } = await this.getMe(headers);

    if (me.id !== id) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user);
    return new HttpException('User deleted', HttpStatus.OK);
  }

  async getUserListings(id: string, paginationParams: Pagination) {
    const take = paginationParams.limit || 10;
    const page = paginationParams.page || 1;
    const skip = (page - 1) * take;

    const user = await this.userRepository.findById(id);

    const [listings, total] = await this.listingRepository.findAndCount({
      where: { user: user },
      take: paginationParams.limit,
      skip,
    });

    return {
      listings,
      meta: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
