// Every mockup type the "Preview mockup" feature supports. Adding a new one
// (a photo + measured quads + a page-size check) only ever means adding a
// module like businessCardMockup.js/weddingInvitationMockup.js and a line
// here — MockupPreviewDialog.jsx and the toolbar button stay generic. A type
// can offer several photo `variants` (different staged scenes for the same
// page size) that the dialog lets the user flip between.

import { isBusinessCardPage, BUSINESS_CARD_MOCKUP_VARIANTS } from "./businessCardMockup";
import { isWeddingInvitationPage, WEDDING_INVITATION_MOCKUP_VARIANTS } from "./weddingInvitationMockup";

const MOCKUP_TYPES = [
  { id: "business-card", isPage: isBusinessCardPage, variants: BUSINESS_CARD_MOCKUP_VARIANTS },
  { id: "wedding-invitation", isPage: isWeddingInvitationPage, variants: WEDDING_INVITATION_MOCKUP_VARIANTS },
];

export function hasAnyMockupPage(pages) {
  return MOCKUP_TYPES.some((mockupType) => pages.some(mockupType.isPage));
}

// Picks the first mockup type with at least one matching page, and returns
// its variants along with just its matching pages (in project order) — the
// dialog maps pages[0]/pages[1] to the front/back slots.
export function findMockupForPages(pages) {
  for (const mockupType of MOCKUP_TYPES) {
    const matchingPages = pages.filter(mockupType.isPage);
    if (matchingPages.length > 0) return { variants: mockupType.variants, pages: matchingPages };
  }
  return null;
}
