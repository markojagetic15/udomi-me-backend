import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { Report } from '@domain/report/Report.entity';
import { dbCall } from '@shared/db-call';

@Injectable()
export class ReportRepository {
  private readonly reportRepository = AppDataSource.getRepository(Report);

  findById(id: string): Promise<Report | null> {
    return dbCall('finding report', () =>
      this.reportRepository.findOne({
        where: { id },
        relations: ['listing', 'listing.user', 'reporter'],
      }),
    );
  }

  findOpenByReporter(
    listingId: string,
    reporterId: string,
  ): Promise<Report | null> {
    return dbCall('finding report', () =>
      this.reportRepository.findOne({
        where: {
          listing: { id: listingId },
          reporter: { id: reporterId },
          status: 'open',
        },
      }),
    );
  }

  findByStatus(
    status: Report['status'],
    take: number,
    skip: number,
  ): Promise<[Report[], number]> {
    return dbCall('finding reports', () =>
      this.reportRepository.findAndCount({
        where: { status },
        relations: ['listing', 'listing.user', 'reporter'],
        order: { created_at: status === 'open' ? 'ASC' : 'DESC' },
        take,
        skip,
      }),
    );
  }

  // Close every other open report on the same listing when one is acted on.
  async closeOpenForListing(
    listingId: string,
    status: Report['status'],
    action: string | null,
  ) {
    await dbCall('updating reports', () =>
      this.reportRepository.update(
        { listing: { id: listingId }, status: 'open' },
        { status, action, resolved_at: new Date() },
      ),
    );
  }

  findForListing(listingId: string): Promise<Report[]> {
    return dbCall('finding reports', () =>
      this.reportRepository.find({
        where: { listing: { id: listingId } },
        relations: ['reporter'],
        order: { created_at: 'DESC' },
      }),
    );
  }

  // Reports against any of the user's listings.
  findAgainstUser(userId: string): Promise<Report[]> {
    return dbCall('finding reports', () =>
      this.reportRepository.find({
        where: { listing: { user: { id: userId } } },
        relations: ['listing', 'reporter'],
        order: { created_at: 'DESC' },
        take: 100,
      }),
    );
  }

  findByReporter(userId: string): Promise<Report[]> {
    return dbCall('finding reports', () =>
      this.reportRepository.find({
        where: { reporter: { id: userId } },
        relations: ['listing'],
        order: { created_at: 'DESC' },
        take: 100,
      }),
    );
  }

  count(where: Partial<Report> = {}): Promise<number> {
    return dbCall('counting reports', () =>
      this.reportRepository.count({ where }),
    );
  }

  save(report: Report): Promise<Report> {
    return dbCall('saving report', () => this.reportRepository.save(report));
  }
}
