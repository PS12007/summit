// Real landscape photos, bundled in public/scenes so the app still works offline.
// Photos come from Wikimedia Commons (free licences — see `credit`/`license`, also shown in Settings).
// Each is a 2560px WebP plus a small thumbnail for the picker.

export type SceneId = "lakelouise" | "lavender" | "aurora" | "dunes" | "sunforest" | "cliffs" | "tulips" | "milkyway" | "autumn" | "lagoon" | "poppies" | "snowforest" | "fjord" | "waterfall" | "reflection";

export interface Scene {
  id: SceneId;
  name: string;
  place: string;
  /** Dark photo → use dark panels. */
  dark: boolean;
  /** How much to darken the top-left so the greeting stays readable (0–1). */
  veil: number;
  /** CSS object-position: which part of the photo to keep when it's cropped to the window. */
  focus: string;
  credit: string;
  license: string;
  source: string;
}

export const SCENES: Scene[] = [
  { id: "lakelouise", name: "Lake Louise", place: "Banff, Canada", dark: false, veil: 0.42, focus: "50% 55%",
    credit: "Chensiyuan", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:1_lake_louise_pano_2019.jpg" },
  { id: "lavender", name: "Lavender rows", place: "Provence, France", dark: false, veil: 0.42, focus: "50% 60%",
    credit: "Santiago Puig Vilado…", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Lavender_field_-_panoramio.jpg" },
  { id: "aurora", name: "Northern lights", place: "Norway", dark: true, veil: 0.12, focus: "50% 50%",
    credit: "Eric Kilby", license: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Aurora_in_Norway1.jpg" },
  { id: "dunes", name: "Sand dunes", place: "Erg Chebbi, Morocco", dark: false, veil: 0.4, focus: "50% 50%",
    credit: "Thomas Fuhrmann", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Erg_Chebbi_in_the_evening_light.jpg" },
  { id: "sunforest", name: "Morning forest", place: "Westphalia, Germany", dark: false, veil: 0.27, focus: "50% 50%",
    credit: "Dietmar Rabich", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Rorup,_NSG_Roruper_Holz_--_2021_--_8187-91.jpg" },
  { id: "cliffs", name: "Sea cliffs", place: "Dingle, Ireland", dark: false, veil: 0.39, focus: "50% 50%",
    credit: "Superbass", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:2019-07-20-Dingle_Lighthouse-0673.jpg" },
  { id: "tulips", name: "Tulip fields", place: "Netherlands", dark: false, veil: 0.32, focus: "50% 50%",
    credit: "Roman Boed from The Netherlands", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:L1002540_(26528392073).jpg" },
  { id: "milkyway", name: "Milky Way", place: "Bernese Alps, Switzerland", dark: true, veil: 0.16, focus: "50% 40%",
    credit: "Deralpinbergsteiger", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Milky_Way_Galaxy_and_Kandersteg_viewed_from_the_Bl%C3%BCmlisalph%C3%BCtte_at_night.jpg" },
  { id: "autumn", name: "Autumn valley", place: "Hinnøya, Norway", dark: false, veil: 0.34, focus: "50% 50%",
    credit: "Ximonic (Simo Räsänen)", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Autumn_landscape_near_Gullesfjordbotn,_Hinn%C3%B8ya,_2010_September.jpg" },
  { id: "lagoon", name: "Glacier lagoon", place: "Jökulsárlón, Iceland", dark: false, veil: 0.39, focus: "50% 50%",
    credit: "Kenny Muir", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Jokulsarlon_lake,_Iceland.jpg" },
  { id: "poppies", name: "Poppy meadow", place: "Dülmen, Germany", dark: false, veil: 0.29, focus: "50% 60%",
    credit: "Dietmar Rabich", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Dernekamp,_Mohn_am_Feldrand_--_2021_--_9239.jpg" },
  { id: "snowforest", name: "Snowy forest", place: "Slavne, Ukraine", dark: false, veil: 0.24, focus: "50% 50%",
    credit: "George Chernilevsky", license: "Public domain", source: "https://commons.wikimedia.org/wiki/File:Forest_road_Slavne_2017_BW_G9.jpg" },
  { id: "fjord", name: "Fjord", place: "Geiranger, Norway", dark: false, veil: 0.34, focus: "50% 55%",
    credit: "Ximonic (Simo Räsänen)", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Geirangerfjord_from_%C3%98rnesvingen,_2013_June.jpg" },
  { id: "waterfall", name: "Jungle falls", place: "Caracol, Brazil", dark: false, veil: 0.15, focus: "60% 50%",
    credit: "Tiago Fioreze", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Caracol_falls_(2_April_2008).jpg" },
  { id: "reflection", name: "Still lake", place: "Canterbury, New Zealand", dark: false, veil: 0.38, focus: "50% 50%",
    credit: "Michal Klajban", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lake_Mystery,_Canterbury,_New_Zealand_05.jpg" },
];

export const sceneById = (id: string): Scene => SCENES.find((s) => s.id === id) ?? SCENES[0];
export const sceneUrl = (id: SceneId) => `/scenes/${id}.webp`;
export const thumbUrl = (id: SceneId) => `/scenes/thumbs/${id}.webp`;

/** A different scene each day, cycling through all of them. */
export function sceneOfTheDay(d = new Date()): Scene {
  const day = Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
  return SCENES[day % SCENES.length];
}

