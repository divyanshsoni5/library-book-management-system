import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { User } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly USER_STORAGE_KEY = 'lms_current_user';
  private http = inject(HttpClient);

  private usersSignal = signal<User[]>([]);
  users = this.usersSignal.asReadonly();

  // Writable signal for current logged in user
  private currentUserSignal = signal<User | null>(this.loadCurrentUser());
  currentUser = this.currentUserSignal.asReadonly();

  constructor() {
    // If we already have a logged in librarian, fetch all users on startup
    const user = this.currentUser();
    if (user && user.role === 'Librarian') {
      this.refreshUsers();
    }
  }

  /**
   * Load active user from localStorage if logged in.
   */
  private loadCurrentUser(): User | null {
    const data = localStorage.getItem(this.USER_STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    return null;
  }

  private mapBackendUser(backendUser: any): User {
    return {
      id: `${backendUser.id}`,
      name: backendUser.username,
      email: backendUser.role === 'LIBRARIAN' ? `${backendUser.username}@sgsits.ac.in` : `${backendUser.username}@student.com`,
      role: backendUser.role === 'LIBRARIAN' ? 'Librarian' : 'Student',
      enrollmentNo: backendUser.role === 'STUDENT' ? backendUser.username : undefined
    };
  }

  /**
   * Login as a Student, Teacher, or Librarian via backend REST API.
   */
  login(role: 'Student' | 'Teacher' | 'Librarian', identifier: string): Observable<boolean> {
    // Since backend role is either STUDENT or LIBRARIAN, map Teacher/Student to STUDENT
    const backendRole = role === 'Librarian' ? 'LIBRARIAN' : 'STUDENT';
    const params = new HttpParams()
      .set('username', identifier.trim())
      .set('role', backendRole);

    return this.http.post<any>('/api/users/login', null, { params }).pipe(
      map(backendUser => {
        if (backendUser && backendUser.id) {
          const user = this.mapBackendUser(backendUser);
          // Preserve Teacher role in UI if they selected Teacher
          if (role === 'Teacher') {
            user.role = 'Teacher';
            user.teacherId = identifier;
          }
          this.currentUserSignal.set(user);
          localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
          if (user.role === 'Librarian') {
            this.refreshUsers();
          }
          return true;
        }
        return false;
      }),
      catchError(err => {
        console.error('Login failed', err);
        // Re-throw so the subscriber's error handler can show the right message
        return throwError(() => err);
      })
    );
  }

  /**
   * Logout and clear session.
   */
  logout(): void {
    this.currentUserSignal.set(null);
    this.usersSignal.set([]);
    localStorage.removeItem(this.USER_STORAGE_KEY);
  }

  /**
   * Fetch all registered users (only for Librarians).
   */
  refreshUsers(): void {
    const currentUser = this.currentUser();
    if (!currentUser || currentUser.role !== 'Librarian') return;

    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', currentUser.id);

    this.http.get<any[]>('/api/librarian/users', { headers }).pipe(
      map(users => users.map(u => this.mapBackendUser(u))),
      catchError(err => {
        console.error('Failed to load users', err);
        return of([]);
      })
    ).subscribe(mappedUsers => {
      this.usersSignal.set(mappedUsers);
    });
  }

  /**
   * Add a new user via API (Librarian only).
   */
  addUser(userData: Omit<User, 'id'>): void {
    const headers = { 'X-User-Role': 'LIBRARIAN' };
    const backendUser = {
      username: userData.name,
      role: userData.role.toUpperCase()
    };

    this.http.post<any>('/api/librarian/users', backendUser, { headers }).subscribe({
      next: () => { this.refreshUsers(); },
      error: (err) => {
        console.warn('Backend POST /api/librarian/users not implemented yet. Adding user to local state.', err);
        const nextId = String(Math.max(...this.usersSignal().map(u => Number(u.id) || 0), 0) + 1);
        this.usersSignal.set([...this.usersSignal(), { ...userData, id: nextId }]);
      }
    });
  }

  /**
   * Delete a user via API (Librarian only).
   */
  deleteUser(id: string): void {
    const headers = { 'X-User-Role': 'LIBRARIAN' };

    this.http.delete<void>(`/api/librarian/users/${id}`, { headers }).subscribe({
      next: () => { this.refreshUsers(); },
      error: (err) => {
        console.warn(`Backend DELETE /api/librarian/users/${id} not implemented. Deleting from local state.`, err);
        this.usersSignal.set(this.usersSignal().filter(u => u.id !== id));
      }
    });
  }

  /**
   * Get all registered users.
   */
  getUsers(): User[] {
    return this.users();
  }
}
