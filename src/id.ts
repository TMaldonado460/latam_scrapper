export class ImdbId {
  public readonly id: string;
  public readonly season: number | undefined;
  public readonly episode: number | undefined;

  public constructor(id: string, season?: number, episode?: number) {
    this.id = id;
    this.season = season;
    this.episode = episode;
  }

  public static fromString(id: string): ImdbId | undefined {
    const parts = id.split(':');
    if (!parts[0] || !/^tt\d+$/.test(parts[0])) return undefined;
    return new ImdbId(
      parts[0],
      parts[1] ? parseInt(parts[1], 10) : undefined,
      parts[2] ? parseInt(parts[2], 10) : undefined,
    );
  }

  public toString(): string {
    return this.season !== undefined
      ? `${this.id}:${this.season}:${this.episode}`
      : this.id;
  }

  public formatSeasonAndEpisode(): string {
    if (this.season === undefined) return '';
    return `S${String(this.season).padStart(2, '0')}E${String(this.episode).padStart(2, '0')}`;
  }
}

export class TmdbId {
  public readonly id: number;
  public readonly season: number | undefined;
  public readonly episode: number | undefined;

  public constructor(id: number, season?: number, episode?: number) {
    this.id = id;
    this.season = season;
    this.episode = episode;
  }

  public toString(): string {
    return this.season !== undefined ? `${this.id}:${this.season}:${this.episode}` : `${this.id}`;
  }
}
