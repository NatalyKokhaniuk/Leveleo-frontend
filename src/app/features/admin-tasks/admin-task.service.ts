import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  AdminTaskFilterDto,
  AdminTaskResponseDto,
  CompleteTaskDto,
  PagedResultDto,
} from './admin-task.types';

@Injectable({ providedIn: 'root' })
export class AdminTaskService {
  private http = inject(HttpClient);
  /** Відповідає TasksController: api/admin/Tasks */
  private readonly base = '/api/admin/tasks';

  private opts = { withCredentials: true as const };

  getTasks(filter: AdminTaskFilterDto): Observable<PagedResultDto<AdminTaskResponseDto>> {
    let params = new HttpParams();
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    params = params.set('page', String(page)).set('pageSize', String(pageSize));
    if (filter.status != null) params = params.set('status', String(filter.status));
    if (filter.type != null) params = params.set('type', String(filter.type));
    if (filter.priority != null) params = params.set('priority', String(filter.priority));
    if (filter.assignedTo?.trim()) params = params.set('assignedTo', filter.assignedTo.trim());

    return this.http.get<PagedResultDto<AdminTaskResponseDto>>(this.base, {
      ...this.opts,
      params,
    });
  }

  getById(taskId: string): Observable<AdminTaskResponseDto> {
    return this.http.get<AdminTaskResponseDto>(`${this.base}/${taskId}`, this.opts);
  }

  assignToMe(taskId: string): Observable<AdminTaskResponseDto> {
    return this.http.post<AdminTaskResponseDto>(`${this.base}/${taskId}/assign`, {}, this.opts);
  }

  complete(taskId: string, dto: CompleteTaskDto): Observable<AdminTaskResponseDto> {
    return this.http.post<AdminTaskResponseDto>(`${this.base}/${taskId}/complete`, dto, this.opts);
  }

  cancel(taskId: string): Observable<AdminTaskResponseDto> {
    return this.http.post<AdminTaskResponseDto>(`${this.base}/${taskId}/cancel`, {}, this.opts);
  }

  /** Пошук активного ShipOrder таска для конкретного замовлення. */
  findOpenShipOrderTask(orderId: string): Observable<AdminTaskResponseDto | null> {
    const target = orderId.trim().toLowerCase();
    if (!target) return of(null);
    const findIn = (status: 'Pending' | 'InProgress') =>
      this.getTasks({ type: 'ShipOrder', status, page: 1, pageSize: 100 }).pipe(
        map((res) =>
          (res.items ?? []).find((t) => (t.relatedEntityId ?? '').trim().toLowerCase() === target) ?? null,
        ),
      );
    return findIn('InProgress').pipe(switchMap((task) => (task ? of(task) : findIn('Pending'))));
  }
}
