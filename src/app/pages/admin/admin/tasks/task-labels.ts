import { TranslateService } from '@ngx-translate/core';
import { AdminTaskResponseDto } from '../../../../features/admin-tasks/admin-task.types';

const P = 'ADMIN.TASKS_PAGE';

export const TASK_STATUS_I18N: Record<string, string> = {
  Pending: `${P}.STATUS.PENDING`,
  InProgress: `${P}.STATUS.IN_PROGRESS`,
  Completed: `${P}.STATUS.COMPLETED`,
  Cancelled: `${P}.STATUS.CANCELLED`,
};

export const TASK_TYPE_I18N: Record<string, string> = {
  ModerateReview: `${P}.TYPE.MODERATE_REVIEW`,
  ShipOrder: `${P}.TYPE.SHIP_ORDER`,
  RefundOrder: `${P}.TYPE.REFUND_ORDER`,
  InvestigatePayment: `${P}.TYPE.INVESTIGATE_PAYMENT`,
  RestockProduct: `${P}.TYPE.RESTOCK_PRODUCT`,
  HandleContactForm: `${P}.TYPE.HANDLE_CONTACT_FORM`,
  Other: `${P}.TYPE.OTHER`,
};

export const TASK_PRIORITY_I18N: Record<string, string> = {
  Low: `${P}.PRIORITY.LOW`,
  Normal: `${P}.PRIORITY.NORMAL`,
  High: `${P}.PRIORITY.HIGH`,
  Critical: `${P}.PRIORITY.CRITICAL`,
};

function labelFromMap(
  translate: TranslateService,
  map: Record<string, string>,
  raw: string,
  fallbackDisplay: string,
): string {
  const key = map[raw];
  if (key) {
    return translate.instant(key);
  }
  const fb = fallbackDisplay?.trim();
  return fb || raw || '—';
}

export function taskStatusLabel(translate: TranslateService, row: AdminTaskResponseDto): string {
  return labelFromMap(translate, TASK_STATUS_I18N, row.status, row.statusDisplay);
}

export function taskTypeLabel(translate: TranslateService, row: AdminTaskResponseDto): string {
  return labelFromMap(translate, TASK_TYPE_I18N, row.type, row.typeDisplay);
}

export function taskPriorityLabel(translate: TranslateService, row: AdminTaskResponseDto): string {
  return labelFromMap(translate, TASK_PRIORITY_I18N, row.priority, row.priorityDisplay);
}

export function taskStatusOptionLabel(translate: TranslateService, name: string): string {
  return labelFromMap(translate, TASK_STATUS_I18N, name, name);
}

export function taskTypeOptionLabel(translate: TranslateService, name: string): string {
  return labelFromMap(translate, TASK_TYPE_I18N, name, name);
}

export function taskPriorityOptionLabel(translate: TranslateService, name: string): string {
  return labelFromMap(translate, TASK_PRIORITY_I18N, name, name);
}
