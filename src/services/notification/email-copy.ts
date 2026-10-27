import { EmailContent, escapeHtml, frontendUrl } from '@shared/mail.service';

type Lang = 'hr' | 'en';
type Data = Record<string, string | number | null | undefined>;

const footnote = (lang: Lang) =>
  lang === 'hr'
    ? 'Obavijesti e-poštom možete isključiti u postavkama profila.'
    : 'You can turn off email notifications in your profile settings.';

const settingsLink = () => `${frontendUrl()}/profile?tab=settings`;

// Every transactional email, in both languages. User-provided values are
// escaped here; the layout itself lives in MailService.
export const emailCopy = {
  verify: (lang: Lang, d: { name: string; token: string }): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Potvrdite svoju e-mail adresu',
          heading: `Dobrodošli, ${d.name}!`,
          paragraphs: [
            'Kliknite na gumb ispod kako biste potvrdili e-mail adresu i mogli dodavati ljubimce.',
          ],
          cta: {
            label: 'Potvrdi e-mail',
            url: `${frontendUrl()}/verify-email?token=${encodeURIComponent(d.token)}`,
          },
          footnote: 'Ako niste otvorili račun, zanemarite ovu poruku.',
        }
      : {
          subject: 'Verify your email address',
          heading: `Welcome, ${d.name}!`,
          paragraphs: [
            'Click the button below to verify your email address so you can add pets.',
          ],
          cta: {
            label: 'Verify email',
            url: `${frontendUrl()}/verify-email?token=${encodeURIComponent(d.token)}`,
          },
          footnote:
            "If you didn't create this account, you can ignore this email.",
        },

  reset: (lang: Lang, d: { token: string }): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Postavite novu lozinku',
          heading: 'Zaboravljena lozinka',
          paragraphs: [
            'Kliknite na gumb ispod za postavljanje nove lozinke. Poveznica vrijedi 1 sat i može se iskoristiti samo jednom.',
          ],
          cta: {
            label: 'Nova lozinka',
            url: `${frontendUrl()}/reset-password?token=${encodeURIComponent(d.token)}`,
          },
          footnote: 'Ako niste zatražili novu lozinku, zanemarite ovu poruku.',
        }
      : {
          subject: 'Reset your password',
          heading: 'Forgot your password?',
          paragraphs: [
            'Click the button below to set a new password. The link is valid for 1 hour and can be used once.',
          ],
          cta: {
            label: 'Set new password',
            url: `${frontendUrl()}/reset-password?token=${encodeURIComponent(d.token)}`,
          },
          footnote: "If you didn't request this, you can ignore this email.",
        },

  message: (lang: Lang, d: Data): EmailContent => {
    const from = escapeHtml(d.from_name);
    const title = escapeHtml(d.listing_title);
    const preview = `<span style="display:block;padding:12px 14px;background:#f4f7f5;border-radius:10px;color:#3a4a41">${escapeHtml(d.preview)}</span>`;
    const url = `${frontendUrl()}/messages/${d.conversation_id}`;
    return lang === 'hr'
      ? {
          subject: `Nova poruka: ${d.listing_title ?? ''}`.trim(),
          heading: 'Imate novu poruku',
          paragraphs: [
            `<b>${from}</b> vam je poslao/la poruku${title ? ` o ljubimcu <b>${title}</b>` : ''}:`,
            preview,
          ],
          cta: { label: 'Odgovori', url },
          footnote: footnote(lang),
        }
      : {
          subject: `New message: ${d.listing_title ?? ''}`.trim(),
          heading: 'You have a new message',
          paragraphs: [
            `<b>${from}</b> sent you a message${title ? ` about <b>${title}</b>` : ''}:`,
            preview,
          ],
          cta: { label: 'Reply', url },
          footnote: footnote(lang),
        };
  },

  interest: (lang: Lang, d: Data): EmailContent => {
    const title = escapeHtml(d.listing_title);
    const url = `${frontendUrl()}/animal/${d.listing_id}`;
    return lang === 'hr'
      ? {
          subject: `Netko je zainteresiran za ${d.listing_title}`,
          heading: 'Netko je zainteresiran za vašeg ljubimca',
          paragraphs: [
            `<b>${escapeHtml(d.from_name)}</b> je zainteresiran/a za <b>${title}</b>. Ukupno zainteresiranih: ${escapeHtml(d.count)}.`,
          ],
          cta: { label: 'Pogledaj ljubimca', url },
          footnote: footnote(lang),
        }
      : {
          subject: `Someone is interested in ${d.listing_title}`,
          heading: 'Someone is interested in your pet',
          paragraphs: [
            `<b>${escapeHtml(d.from_name)}</b> is interested in <b>${title}</b>. Interested so far: ${escapeHtml(d.count)}.`,
          ],
          cta: { label: 'View pet', url },
          footnote: footnote(lang),
        };
  },

  saved_search_match: (lang: Lang, d: Data): EmailContent => {
    const url = `${frontendUrl()}/animal/${d.listing_id}`;
    return lang === 'hr'
      ? {
          subject: `Novi ljubimac za "${d.saved_search_name}"`,
          heading: 'Stigao je novi ljubimac za vas',
          paragraphs: [
            `<b>${escapeHtml(d.listing_title)}</b> odgovara vašoj spremljenoj pretrazi <b>${escapeHtml(d.saved_search_name)}</b>.`,
          ],
          cta: { label: 'Pogledaj ljubimca', url },
          footnote: footnote(lang),
        }
      : {
          subject: `New pet for "${d.saved_search_name}"`,
          heading: 'A new pet for you',
          paragraphs: [
            `<b>${escapeHtml(d.listing_title)}</b> matches your saved search <b>${escapeHtml(d.saved_search_name)}</b>.`,
          ],
          cta: { label: 'View pet', url },
          footnote: footnote(lang),
        };
  },

  listing_hidden: (lang: Lang, d: Data): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Vaša objava je uklonjena',
          heading: 'Objava je uklonjena nakon prijave',
          paragraphs: [
            `Vaša objava <b>${escapeHtml(d.listing_title)}</b> uklonjena je jer krši pravila korištenja. Ako smatrate da je riječ o pogrešci, odgovorite na ovu poruku.`,
          ],
          footnote: '',
        }
      : {
          subject: 'Your post was removed',
          heading: 'Post removed after a report',
          paragraphs: [
            `Your post <b>${escapeHtml(d.listing_title)}</b> was removed because it breaks the terms of use. If you think this is a mistake, reply to this email.`,
          ],
          footnote: '',
        },

  listing_removed: (lang: Lang, d: Data): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Vaša objava je obrisana',
          heading: 'Objava je obrisana',
          paragraphs: [
            `Administrator je obrisao vašu objavu <b>${escapeHtml(d.listing_title)}</b> jer krši pravila korištenja. Ako smatrate da je riječ o pogrešci, odgovorite na ovu poruku.`,
          ],
          footnote: '',
        }
      : {
          subject: 'Your post was deleted',
          heading: 'Post deleted',
          paragraphs: [
            `An administrator deleted your post <b>${escapeHtml(d.listing_title)}</b> because it breaks the terms of use. If you think this is a mistake, reply to this email.`,
          ],
          footnote: '',
        },

  shelter_verified: (lang: Lang, d: Data): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Vaše sklonište je verificirano',
          heading: 'Čestitamo!',
          paragraphs: [
            `<b>${escapeHtml(d.shelter_name)}</b> sada ima oznaku verificiranog skloništa uz sve svoje ljubimce i na profilu.`,
          ],
          cta: {
            label: 'Pogledaj profil',
            url: `${frontendUrl()}/users/${d.user_id}`,
          },
          footnote: footnote(lang),
        }
      : {
          subject: 'Your shelter is verified',
          heading: 'Congratulations!',
          paragraphs: [
            `<b>${escapeHtml(d.shelter_name)}</b> now shows a verified shelter badge on all its pets and its profile.`,
          ],
          cta: {
            label: 'View profile',
            url: `${frontendUrl()}/users/${d.user_id}`,
          },
          footnote: footnote(lang),
        },

  shelter_rejected: (lang: Lang, d: Data): EmailContent =>
    lang === 'hr'
      ? {
          subject: 'Zahtjev za verifikaciju skloništa',
          heading: 'Zahtjev nije odobren',
          paragraphs: [
            `Nažalost, nismo mogli verificirati <b>${escapeHtml(d.shelter_name)}</b>. Odgovorite na ovu poruku s dodatnim informacijama (npr. OIB udruge, web stranica) i ponovno ćemo pregledati zahtjev.`,
          ],
          cta: { label: 'Postavke', url: settingsLink() },
          footnote: footnote(lang),
        }
      : {
          subject: 'Shelter verification request',
          heading: 'Request not approved',
          paragraphs: [
            `Unfortunately we couldn't verify <b>${escapeHtml(d.shelter_name)}</b>. Reply to this email with more details (e.g. registration number, website) and we'll take another look.`,
          ],
          cta: { label: 'Settings', url: settingsLink() },
          footnote: footnote(lang),
        },

  shelter_application: (lang: Lang, d: Data): EmailContent =>
    lang === 'hr'
      ? {
          subject: `Novi zahtjev za sklonište: ${d.shelter_name}`,
          heading: 'Novi zahtjev za verifikaciju skloništa',
          paragraphs: [`<b>${escapeHtml(d.shelter_name)}</b> čeka pregled.`],
          cta: {
            label: 'Admin panel',
            url: `${frontendUrl()}/admin?tab=shelters`,
          },
        }
      : {
          subject: `New shelter application: ${d.shelter_name}`,
          heading: 'New shelter verification request',
          paragraphs: [
            `<b>${escapeHtml(d.shelter_name)}</b> is waiting for review.`,
          ],
          cta: {
            label: 'Admin panel',
            url: `${frontendUrl()}/admin?tab=shelters`,
          },
        },
};
