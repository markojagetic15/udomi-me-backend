import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Report } from '@domain/report/Report.entity';
import { User } from '@domain/user/User.entity';
import { ReportListingDto } from '@application/dto/listing/listing-actions.dto';
import { ListingRepository } from '@infrastructure/listing.repository';
import { ReportRepository } from '@infrastructure/report.repository';
import { UserService } from '../user/user.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly userService: UserService,
    private readonly listingRepository: ListingRepository,
    private readonly reportRepository: ReportRepository,
  ) {}

  async reportListing(
    listingId: string,
    body: ReportListingDto,
    token: string,
  ) {
    const me = await this.userService.getMe(token, []);
    const listing = await this.listingRepository.findById(listingId, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.user?.id === me.id) {
      throw new BadRequestException('You cannot report your own listing');
    }
    if (await this.reportRepository.findOpenByReporter(listing.id, me.id)) {
      throw new ConflictException('ALREADY_REPORTED');
    }

    const report = new Report();
    report.id = uuidv4();
    report.listing = listing;
    report.reporter = { id: me.id } as User;
    report.reason = body.reason;
    report.details = body.details?.trim() || null;
    report.status = 'open';
    await this.reportRepository.save(report);
    return { message: 'Listing reported' };
  }
}
