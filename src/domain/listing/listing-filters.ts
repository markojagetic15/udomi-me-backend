import { BadRequestException } from '@nestjs/common';
import { Category } from './Category.enum';
import { LISTING_TYPES, ListingType } from './Listing.entity';

// One filter shape shared by GET /listings (applied in SQL by
// ListingRepository.search) and saved-search alerts (matched in memory by
// matchesFilters below) — keep the two in sync when adding a filter.
export interface ListingFilters {
  type?: ListingType;
  search?: string;
  categories?: Category[];
  gender?: 'male' | 'female';
  size_min?: number;
  size_max?: number;
  // Age in months, from date_of_birth.
  age_min?: number;
  age_max?: number;
  city?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  vaccinated?: boolean;
  sterilized?: boolean;
  good_with_kids?: boolean;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  urgent?: boolean;
  shelter_only?: boolean;
  free_only?: boolean;
}

export const LISTING_SORTS = ['newest', 'oldest', 'nearest', 'urgent'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

type Query = Record<string, string | string[] | undefined>;

const str = (q: Query, k: string) => {
  const v = q[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === '' ? undefined : s;
};

const num = (q: Query, k: string, min = -Infinity, max = Infinity) => {
  const s = str(q, k);
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new BadRequestException(`Invalid ${k}`);
  }
  return n;
};

// Flag filters only ever narrow ("must be vaccinated"); absent/false = no filter.
const flag = (q: Query, k: string) => (str(q, k) === 'true' ? true : undefined);

const parseCategories = (raw: string | undefined): Category[] | undefined => {
  if (!raw) return undefined;
  let list: unknown;
  try {
    list = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(',');
  } catch {
    throw new BadRequestException('Invalid category');
  }
  if (!Array.isArray(list)) throw new BadRequestException('Invalid category');
  const valid = Object.values(Category) as string[];
  const cats = list.map(String).filter((c) => valid.includes(c)) as Category[];
  return cats.length ? cats : undefined;
};

export const parseListingFilters = (q: Query): ListingFilters => {
  const type = str(q, 'type');
  if (type && !LISTING_TYPES.includes(type as ListingType)) {
    throw new BadRequestException('Invalid type');
  }
  const gender = str(q, 'gender');
  if (gender && gender !== 'male' && gender !== 'female') {
    throw new BadRequestException('Invalid gender');
  }
  const filters: ListingFilters = {
    type: (type as ListingType) ?? undefined,
    search: str(q, 'search')?.trim().slice(0, 100) || undefined,
    categories: parseCategories(str(q, 'category')),
    gender: gender as ListingFilters['gender'],
    size_min: num(q, 'size_min', 0, 1000),
    size_max: num(q, 'size_max', 0, 1000),
    age_min: num(q, 'age_min', 0, 600),
    age_max: num(q, 'age_max', 0, 600),
    city: str(q, 'city')?.trim().slice(0, 100) || undefined,
    lat: num(q, 'lat', -90, 90),
    lng: num(q, 'lng', -180, 180),
    radius_km: num(q, 'radius_km', 1, 1000),
    vaccinated: flag(q, 'vaccinated'),
    sterilized: flag(q, 'sterilized'),
    good_with_kids: flag(q, 'good_with_kids'),
    good_with_dogs: flag(q, 'good_with_dogs'),
    good_with_cats: flag(q, 'good_with_cats'),
    urgent: flag(q, 'urgent'),
    shelter_only: flag(q, 'shelter_only'),
    free_only: flag(q, 'free_only'),
  };
  if ((filters.lat === undefined) !== (filters.lng === undefined)) {
    throw new BadRequestException('lat and lng must be given together');
  }
  // Drop undefined keys so saved searches store a compact object.
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  ) as ListingFilters;
};

export const parseListingSort = (q: Query): ListingSort => {
  const sort = str(q, 'sort') ?? 'newest';
  if (!LISTING_SORTS.includes(sort as ListingSort)) {
    throw new BadRequestException('Invalid sort');
  }
  return sort as ListingSort;
};

export const ageInMonths = (dateOfBirth: string | Date | null | undefined) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  return (
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth())
  );
};

export const distanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// In-memory equivalent of ListingRepository.search's WHERE clause.
export const matchesFilters = (
  listing: {
    listing_type?: ListingType;
    title?: string;
    description?: string;
    breed?: string;
    category?: Category;
    gender?: string;
    size?: number;
    date_of_birth?: string | null;
    city?: string | null;
    address?: string;
    lat?: number;
    lng?: number;
    is_vaccinated?: boolean;
    is_sterilized?: boolean;
    good_with_kids?: boolean;
    good_with_dogs?: boolean;
    good_with_cats?: boolean;
    is_urgent?: boolean;
    adoption_fee?: number | null;
  },
  f: ListingFilters,
  ownerIsVerifiedShelter: boolean,
): boolean => {
  if ((listing.listing_type ?? 'adoption') !== (f.type ?? 'adoption'))
    return false;
  if (f.search) {
    const hay =
      `${listing.title ?? ''} ${listing.breed ?? ''} ${listing.description ?? ''}`.toLowerCase();
    if (!hay.includes(f.search.toLowerCase())) return false;
  }
  if (
    f.categories?.length &&
    !f.categories.includes(listing.category as Category)
  )
    return false;
  if (f.gender && listing.gender !== f.gender) return false;
  if (f.size_min !== undefined && (listing.size ?? 0) < f.size_min)
    return false;
  if (f.size_max !== undefined && (listing.size ?? 0) > f.size_max)
    return false;
  if (f.age_min !== undefined || f.age_max !== undefined) {
    const age = ageInMonths(listing.date_of_birth);
    if (age === null) return false;
    if (f.age_min !== undefined && age < f.age_min) return false;
    if (f.age_max !== undefined && age > f.age_max) return false;
  }
  if (f.city) {
    const where =
      `${listing.city ?? ''} ${listing.address ?? ''}`.toLowerCase();
    if (!where.includes(f.city.toLowerCase())) return false;
  }
  if (f.lat !== undefined && f.lng !== undefined && f.radius_km) {
    if (listing.lat == null || listing.lng == null) return false;
    if (distanceKm(f.lat, f.lng, listing.lat, listing.lng) > f.radius_km)
      return false;
  }
  if (f.vaccinated && !listing.is_vaccinated) return false;
  if (f.sterilized && !listing.is_sterilized) return false;
  if (f.good_with_kids && !listing.good_with_kids) return false;
  if (f.good_with_dogs && !listing.good_with_dogs) return false;
  if (f.good_with_cats && !listing.good_with_cats) return false;
  if (f.urgent && !listing.is_urgent) return false;
  if (f.shelter_only && !ownerIsVerifiedShelter) return false;
  if (f.free_only && listing.adoption_fee) return false;
  return true;
};
