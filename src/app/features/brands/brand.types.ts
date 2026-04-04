export interface BrandTranslationResponseDto {
  id?: string;
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface BrandResponseDto {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  logoKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  translations: BrandTranslationResponseDto[];
}

export interface CreateBrandTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface CreateBrandDto {
  name: string;
  description?: string | null;
  logoKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  translations?: CreateBrandTranslationDto[] | null;
}

/** Плоский JSON для оновлення (без Optional-обгорток). */
export interface UpdateBrandDto {
  name?: string;
  description?: string | null;
  logoKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}
