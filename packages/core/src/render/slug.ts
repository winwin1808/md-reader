export class Slugger {
  private occurrences: Record<string, number> = Object.create(null)

  slug(value: string): string {
    let slug = value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-')

    const originalSlug = slug

    while (Object.prototype.hasOwnProperty.call(this.occurrences, slug)) {
      this.occurrences[originalSlug]!++
      slug = `${originalSlug}-${this.occurrences[originalSlug]}`
    }

    this.occurrences[slug] = 0

    return slug
  }

  reset(): void {
    this.occurrences = Object.create(null)
  }
}
