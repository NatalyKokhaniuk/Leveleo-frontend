/** Відповідає ContactFormCategory на бекенді (JSON як число). */
export enum ContactFormCategory {
  DeliveryQuestion = 1,
  OrderQuestion = 2,
  ReturnOrExchange = 3,
  ProductQuestion = 4,
  WebsiteQuestion = 5,
  PaymentQuestion = 6,
  Other = 99,
}

export interface CreateContactFormDto {
  subject: string;
  message: string;
  category: ContactFormCategory;
  email: string;
  phone?: string | null;
}

export interface ContactFormResponseDto {
  id: string;
  subject: string;
  message: string;
  category: ContactFormCategory;
  categoryDisplay: string;
  email: string;
  phone?: string | null;
  createdAt: string;
}
