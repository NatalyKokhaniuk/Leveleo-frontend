/**
 * DTO відповіді по перекладу категорії
 */
export interface CategoryTranslationResponseDto {
  id?: string;
  languageCode: string;
  name: string;
  description?: string | null;
}

/**
 * DTO відповіді по категорії
 */
export interface CategoryResponseDto {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  fullPath: string;
  translations: CategoryTranslationResponseDto[];
}

/**
 * DTO для breadcrumbs (батьківські та дочірні категорії)
 */
export interface CategoryBreadcrumbsDto {
  parents: CategoryResponseDto[];
  children: CategoryResponseDto[];
}

/**
 * DTO перекладу при створенні/оновленні
 */
export interface CreateCategoryTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

/**
 * DTO створення категорії
 */
export interface CreateCategoryDto {
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  translations?: CreateCategoryTranslationDto[] | null;
}

/**
 * Оновлення категорії — плоский JSON (поля опційні для часткового PATCH).
 */
export interface UpdateCategoryDto {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}
