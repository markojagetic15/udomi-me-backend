import { User } from './User.entity';

// What other people may see about a user. Never includes email; individuals
// show first name + last initial, verified shelters their public details.
export const publicUser = (u: User | null | undefined) => {
  if (!u) return null;
  const isShelter =
    u.account_type === 'shelter' && u.shelter_status === 'verified';
  return {
    id: u.id,
    first_name: u.first_name,
    last_initial: u.last_name ? `${u.last_name.charAt(0)}.` : '',
    avatar_url: u.avatar_url ?? null,
    account_type: isShelter ? 'shelter' : 'individual',
    shelter_status: isShelter ? 'verified' : 'none',
    shelter_name: isShelter ? u.shelter_name : null,
    shelter_city: isShelter ? u.shelter_city : null,
    shelter_description: isShelter ? u.shelter_description : null,
    shelter_website: isShelter ? u.shelter_website : null,
    shelter_phone: isShelter ? u.shelter_phone : null,
    created_at: u.created_at,
  };
};

export type PublicUser = NonNullable<ReturnType<typeof publicUser>>;

export const displayName = (
  u: Pick<
    User,
    | 'first_name'
    | 'last_name'
    | 'account_type'
    | 'shelter_status'
    | 'shelter_name'
  >,
) =>
  u.account_type === 'shelter' &&
  u.shelter_status === 'verified' &&
  u.shelter_name
    ? u.shelter_name
    : `${u.first_name} ${u.last_name ? `${u.last_name.charAt(0)}.` : ''}`.trim();
