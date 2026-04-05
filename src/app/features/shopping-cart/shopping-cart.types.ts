/** Відповідає ShoppingCartDto / ShoppingCartItemDto на бекенді. */
export interface ShoppingCartItemDto {
  productId: string;
  quantity: number;
}

export interface ShoppingCartDto {
  items?: ShoppingCartItemDto[] | null;
}

export interface AddCartItemDto {
  productId: string;
  quantity: number;
}
