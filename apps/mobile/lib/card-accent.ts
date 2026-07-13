import type { SurfaceAccentTone } from '@/constants/surface';
import type { TagTone } from '@/constants/theme';

export type {
  CardAccentTone,
  CardTagTone,
} from '@veka/shared';

export {
  assemblyAccentTone,
  assemblyTagTone,
  docAccentTone,
  packageAccentTone,
  packageStatusLabel,
  packageTagTone,
  postAccentTone,
  postTypeTag,
  reservationAccentTone,
  reservationTagTone,
  routineCardVariant,
  scopeTagTone,
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
