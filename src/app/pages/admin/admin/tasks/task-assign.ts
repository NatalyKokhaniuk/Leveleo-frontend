import { AdminTaskResponseDto } from '../../../../features/admin-tasks/admin-task.types';

/**
 * Чи показувати «Взяти в роботу»: лише Pending/InProgress і не тоді,
 * коли виконавець уже поточний користувач (не можна «призначити себе» повторно).
 */
export function canShowAssignToMe(
  task: AdminTaskResponseDto,
  currentUserId: string | undefined,
): boolean {
  if (task.status !== 'Pending' && task.status !== 'InProgress') {
    return false;
  }
  if (!currentUserId?.trim()) {
    return false;
  }
  const assignee = task.assignedTo?.trim();
  if (!assignee) {
    return true;
  }
  return assignee !== currentUserId;
}
