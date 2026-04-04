/** Числові значення (як у C# enum) — для довідки; у JSON API зазвичай приходять рядки. */
export enum AdminTaskType {
  ModerateReview = 1,
  ShipOrder = 2,
  RefundOrder = 3,
  InvestigatePayment = 4,
  RestockProduct = 5,
  HandleContactForm = 6,
  Other = 99,
}

export enum AdminTaskPriority {
  Low = 1,
  Normal = 2,
  High = 3,
  Critical = 4,
}

export enum AdminTaskStatus {
  Pending = 1,
  InProgress = 2,
  Completed = 3,
  Cancelled = 4,
}

/**
 * Відповідає AdminTaskResponseDto з API.
 * System.Text.Json серіалізує enum як рядки: "Pending", "HandleContactForm", …
 */
export interface AdminTaskResponseDto {
  id: string;
  title: string;
  description: string;
  type: string;
  typeDisplay: string;
  priority: string;
  priorityDisplay: string;
  status: string;
  statusDisplay: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  metadata: string | null;
  assignedTo: string | null;
  createdAt: string;
  completedAt: string | null;
  completionNote: string | null;
  requesterEmail: string | null;
}

export interface CompleteTaskDto {
  completionNote?: string | null;
}

/** Query-фільтр; enum на бекенді біндиться з рядка (наприклад status=Pending). */
export interface AdminTaskFilterDto {
  status?: string;
  type?: string;
  priority?: string;
  assignedTo?: string | null;
  page?: number;
  pageSize?: number;
}

export interface PagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
