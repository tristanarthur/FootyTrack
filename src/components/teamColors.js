// AFL team colors — primary color per team name
export const teamColors = {
  "Adelaide": "#002B5C",
  "Brisbane Lions": "#A30046",
  "Carlton": "#0E1E2D",
  "Collingwood": "#000000",
  "Essendon": "#CC2031",
  "Fremantle": "#2C1654",
  "Geelong": "#1C3C6B",
  "Gold Coast": "#E2252B",
  "Greater Western Sydney": "#F47920",
  "Hawthorn": "#4D2004",
  "Melbourne": "#003087",
  "North Melbourne": "#003CB5",
  "Port Adelaide": "#008AAB",
  "Richmond": "#FFD200",
  "St Kilda": "#ED0F05",
  "Sydney": "#E2001A",
  "West Coast": "#002B7F",
  "Western Bulldogs": "#014896",
};

// Return a color for a team name, falling back to a neutral
export function teamColor(name) {
  return teamColors[name] ?? "#888";
}

// Sorted list of all team names
export const teamNames = Object.keys(teamColors).sort();

// Domain + range arrays for Plot color scales
export const teamColorDomain = teamNames;
export const teamColorRange = teamNames.map((n) => teamColors[n]);
