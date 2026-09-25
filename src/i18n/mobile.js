// Strings for the phone layout (bottom bar, bottom sheets, top-bar Menu
// sheet, View sheet). Same `{ en: {...}, fr: {...} }` shape as the other
// files under src/i18n/. Names that already exist elsewhere (File/Edit/View
// menus, panel titles, Share, Log out...) are reused from those files
// rather than duplicated here.
export const MOBILE_STRINGS = {
  en: {
    bottomBar: { aria: "Editor tools", add: "Add", edit: "Edit", layers: "Layers", pages: "Pages", view: "View" },
    sheet: { close: "Close", back: "Back" },
    addSheetTitle: "Add to your design",
    menu: { button: "Menu", title: "Menu", account: "Account", settings: "Settings" },
    view: {
      title: "View",
      zoom: "Zoom",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      zoomPercentage: "Zoom percentage",
      fit: "Fit to screen",
      pageSize: "Page size",
      units: "Units",
      timeline: "Timeline",
      present: "Present",
    },
  },
  fr: {
    bottomBar: { aria: "Outils de l'éditeur", add: "Ajouter", edit: "Modifier", layers: "Calques", pages: "Pages", view: "Vue" },
    sheet: { close: "Fermer", back: "Retour" },
    addSheetTitle: "Ajouter à votre design",
    menu: { button: "Menu", title: "Menu", account: "Compte", settings: "Paramètres" },
    view: {
      title: "Vue",
      zoom: "Zoom",
      zoomOut: "Zoom arrière",
      zoomIn: "Zoom avant",
      zoomPercentage: "Pourcentage de zoom",
      fit: "Ajuster à l'écran",
      pageSize: "Taille de la page",
      units: "Unités",
      timeline: "Chronologie",
      present: "Présenter",
    },
  },
};
