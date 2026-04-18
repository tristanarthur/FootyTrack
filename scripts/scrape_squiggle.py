#!/usr/bin/env python3
"""
Scrape AFL data from api.squiggle.com.au and write/update CSVs in data/.

Usage:
    python scripts/scrape_squiggle.py             # current year only
    python scripts/scrape_squiggle.py --backfill  # all years from 2012
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import requests

BASE_URL = "https://api.squiggle.com.au/"
HEADERS = {
    "User-Agent": "FootyTrack - tristanarthur2000@gmail.com"
}
DATA_DIR = Path(__file__).parent.parent / "data"
BACKFILL_FROM = 2012

# Column ordering for each CSV (also controls what we keep)
GAMES_COLS = [
    "id", "year", "round", "roundname", "date", "hteam", "hteamid",
    "ateam", "ateamid", "hscore", "ascore", "hgoals", "hbehinds",
    "agoals", "abehinds", "winner", "winnerteamid", "venue",
    "complete", "is_final", "is_grand_final", "updated",
]
STANDINGS_COLS = [
    "year", "round", "id", "name", "rank", "played", "wins",
    "losses", "draws", "for", "against", "percentage", "pts",
    "goals_for", "goals_against", "behinds_for", "behinds_against",
]
TIPS_COLS = [
    "gameid", "sourceid", "source", "year", "round", "hteamid", "ateamid",
    "tipteamid", "tip", "margin", "confidence", "correct", "bits", "updated",
]
POWER_COLS = [
    "year", "round", "sourceid", "source", "teamid", "team", "rank", "power", "updated",
]


def fetch(q: str, **params) -> pd.DataFrame:
    """Fetch a query from the Squiggle API and return a DataFrame."""
    for attempt in range(3):
        try:
            resp = requests.get(
                BASE_URL,
                params={"q": q, "format": "json", **params},
                headers=HEADERS,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            # The API wraps results in a key matching the query name
            key = q if q in data else list(data.keys())[0]
            rows = data.get(key, [])
            if not rows:
                return pd.DataFrame()
            return pd.DataFrame(rows)
        except requests.RequestException as e:
            if attempt == 2:
                print(f"  ERROR fetching {q} {params}: {e}", file=sys.stderr)
                sys.exit(1)
            time.sleep(2 ** attempt)
    return pd.DataFrame()


def upsert(df_new: pd.DataFrame, path: Path, key_cols: list[str], col_order: list[str]) -> int:
    """
    Merge df_new into the existing CSV at path, deduplicating on key_cols.
    Returns the number of new/updated rows written.
    """
    if df_new.empty:
        return 0

    # Keep only columns we care about (ignore extras from API)
    available = [c for c in col_order if c in df_new.columns]
    df_new = df_new[available].copy()

    if path.exists():
        df_old = pd.read_csv(path, low_memory=False)
        # Align columns — add any missing cols as NaN
        for col in df_new.columns:
            if col not in df_old.columns:
                df_old[col] = pd.NA
        combined = pd.concat([df_old, df_new], ignore_index=True)
    else:
        combined = df_new

    combined = combined.drop_duplicates(subset=key_cols, keep="last")
    combined = combined.sort_values(key_cols).reset_index(drop=True)

    # Only write columns we know about, in order
    final_cols = [c for c in col_order if c in combined.columns]
    combined = combined[final_cols]
    combined.to_csv(path, index=False)
    return len(df_new)


def current_rounds_on_record(path: Path, year_col: str, round_col: str) -> set[tuple]:
    """Return set of (year, round) pairs already in the CSV."""
    if not path.exists():
        return set()
    df = pd.read_csv(path, usecols=[year_col, round_col], low_memory=False)
    return set(zip(df[year_col], df[round_col]))


def get_completed_rounds(year: int) -> list[int]:
    """Return list of rounds that have at least one complete game in games.csv."""
    path = DATA_DIR / "games.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path, usecols=["year", "round", "complete"], low_memory=False)
    df = df[(df["year"] == year) & (df["complete"] == 100)]
    return sorted(df["round"].unique().tolist())


def scrape_teams():
    print("  teams...", end=" ")
    df = fetch("teams")
    n = upsert(df, DATA_DIR / "teams.csv", ["id"],
               ["id", "name", "abbrev", "logo", "debut", "retirement"])
    print(f"{n} rows")


def scrape_sources():
    print("  sources...", end=" ")
    df = fetch("sources")
    n = upsert(df, DATA_DIR / "sources.csv", ["id"], ["id", "name", "url"])
    print(f"{n} rows")


def scrape_games(years: list[int]):
    path = DATA_DIR / "games.csv"
    for year in years:
        print(f"  games {year}...", end=" ")
        df = fetch("games", year=year)
        n = upsert(df, path, ["id"], GAMES_COLS)
        print(f"{n} rows")
        time.sleep(0.5)


def scrape_standings(years: list[int]):
    path = DATA_DIR / "standings.csv"
    existing = current_rounds_on_record(path, "year", "round")
    for year in years:
        completed = get_completed_rounds(year)
        for rnd in completed:
            if (year, rnd) in existing:
                continue
            print(f"  standings {year} r{rnd}...", end=" ")
            df = fetch("standings", year=year, round=rnd)
            if not df.empty:
                df["year"] = year
                df["round"] = rnd
            n = upsert(df, path, ["year", "round", "id"], STANDINGS_COLS)
            print(f"{n} rows")
            existing.add((year, rnd))
            time.sleep(0.5)


def scrape_tips(years: list[int]):
    path = DATA_DIR / "tips.csv"
    for year in years:
        print(f"  tips {year}...", end=" ")
        df = fetch("tips", year=year)
        n = upsert(df, path, ["gameid", "sourceid"], TIPS_COLS)
        print(f"{n} rows")
        time.sleep(0.5)


def scrape_power(years: list[int]):
    path = DATA_DIR / "power.csv"
    existing = current_rounds_on_record(path, "year", "round")
    for year in years:
        completed = get_completed_rounds(year)
        for rnd in completed:
            if (year, rnd) in existing:
                continue
            print(f"  power {year} r{rnd}...", end=" ")
            df = fetch("power", year=year, round=rnd)
            if not df.empty:
                df["year"] = year
                df["round"] = rnd
            n = upsert(df, path, ["year", "round", "sourceid", "teamid"], POWER_COLS)
            print(f"{n} rows")
            existing.add((year, rnd))
            time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="Scrape Squiggle AFL data")
    parser.add_argument("--backfill", action="store_true",
                        help="Pull all years from BACKFILL_FROM to current")
    args = parser.parse_args()

    DATA_DIR.mkdir(exist_ok=True)
    aest = ZoneInfo("Australia/Melbourne")
    current_year = datetime.now(aest).year
    years = list(range(BACKFILL_FROM, current_year + 1)) if args.backfill else [current_year]

    print(f"Scraping years: {years[0]}–{years[-1]}" if len(years) > 1 else f"Scraping year: {current_year}")

    scrape_teams()
    scrape_sources()
    scrape_games(years)
    scrape_standings(years)
    scrape_tips(years)
    scrape_power(years)

    print("Done.")


if __name__ == "__main__":
    main()
