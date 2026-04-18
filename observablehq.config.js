import {teamNames} from "./src/components/teamColors.js";

const teamSlugs = teamNames.map((n) => n.toLowerCase().replace(/\s+/g, "-"));

export default {
  title: "FootyTrack",
  theme: ["air", "near-midnight"],
  root: "src",
  output: "dist",
  pages: [
    {name: "Ladder", path: "/ladder"},
    {name: "Teams", path: "/teams"},
    {name: "Games", path: "/games"},
    {name: "Tips", path: "/tips"},
    {name: "Power Rankings", path: "/power"},
  ],
  dynamicPaths: teamSlugs.map((slug) => `/teams/${slug}`),
  head: '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏉</text></svg>">',
  footer: "Data: api.squiggle.com.au · Built with Observable Framework",
};
