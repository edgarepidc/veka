export const HOME_ILLUSTRATIONS = {
  paid: '/home/home-insight-paid.png',
  due: '/home/home-insight-due.png',
  calendar: '/home/home-insight-calendar.png',
  package: '/home/home-insight-package.png',
  notice: '/home/home-insight-notice.png',
  maintenance: '/home/home-insight-maintenance.png',
  visit: '/home/home-insight-visit.png',
} as const;

export type HomeIllustrationKey = keyof typeof HOME_ILLUSTRATIONS;
