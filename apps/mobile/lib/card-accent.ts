import type { SurfaceAccentTone } from '@/constants/surface';
import type { TagTone } from '@/constants/theme';

export type {
  CardAccentTone,
  CardTagTone,
} from '@veka/shared';

export {
  packageAccentTone,
  packageStatusLabel,
  packageTagTone,
  reservationAccentTone,
  reservationTagTone,
  routineCardVariant,
  ticketAccentTone,
  ticketTagTone,
  visitAccentTone,
  visitStatusLabel,
  visitTagTone,
} from '@veka/shared';

/** @deprecated Use CardAccentTone from @veka/shared */
export type { SurfaceAccentTone };

/** @deprecated Use CardTagTone from @veka/shared */
export type { TagTone };
