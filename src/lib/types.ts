export interface Lecture {
  id: string;
  title: string;
  order: number;
  durationMinutes: number;
  objectives: string[];
  status: "draft" | "review" | "published";
}

/** A teaching center registered in the portal's `data/centers.json`. */
export interface Center {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  language: string;
  dir: "rtl" | "ltr";
  level: string;
  category: string;
  tags: string[];
  lectures: Lecture[];
  schemaVersion: "1.0.0";
  templateVersion: string;
  license: string;
  updatedAt: string;
  featured?: boolean;
  courseUrl: string;
  /** Resolved center names copied into the catalog by the generator. */
  centers?: string[];
  [key: string]: unknown;
}

export interface Filters {
  level?: string;
  language?: string;
  category?: string;
  tags?: string[];
  centers?: string;
}

export type SearchIndex = Map<string, Course[]>;

export interface FilterOptions {
  levels: string[];
  languages: string[];
  categories: string[];
  tags: string[];
  centers: string[];
}
