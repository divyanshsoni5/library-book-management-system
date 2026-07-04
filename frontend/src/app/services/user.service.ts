import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
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
    let finalRole: 'Student' | 'Teacher' | 'Librarian' = 'Student';
    if (backendUser.role === 'LIBRARIAN') {
      finalRole = 'Librarian';
    } else if (backendUser.role === 'TEACHER') {
      finalRole = 'Teacher';
    }
    return {
      id: `${backendUser.id}`,
      name: backendUser.name || backendUser.username,
      email: backendUser.email || (backendUser.role === 'LIBRARIAN' ? `${backendUser.username}@sgsits.ac.in` : `${backendUser.username}@student.com`),
      role: finalRole,
      enrollmentNo: backendUser.role === 'STUDENT' ? backendUser.username : undefined,
      teacherId: backendUser.role === 'TEACHER' ? backendUser.username : undefined
    };
  }

  /**
   * Login as a Student, Teacher, or Librarian via backend REST API.
   */
  login(role: 'Student' | 'Teacher' | 'Librarian', identifier: string): Observable<boolean> {
    const backendRole = role.toUpperCase();
    const params = new HttpParams()
      .set('username', identifier.trim())
      .set('role', backendRole);

    return this.http.post<any>('/api/users/login', null, { params }).pipe(
      map(backendUser => {
        if (backendUser && backendUser.id) {
          const user = this.mapBackendUser(backendUser);
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

  getUsersObservable(): Observable<User[]> {
    const currentUser = this.currentUser();
    if (!currentUser || currentUser.role !== 'Librarian') return of([]);

    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', currentUser.id);

    return this.http.get<any[]>('/api/librarian/users', { headers }).pipe(
      map(users => users.map(u => this.mapBackendUser(u))),
      catchError(err => {
        console.error('Failed to load users via backend', err);
        return of([]);
      })
    );
  }

  /**
   * Fetch all registered users (only for Librarians).
   */
  refreshUsers(): void {
    this.getUsersObservable().subscribe(mappedUsers => {
      this.usersSignal.set(mappedUsers);
    });
  }

  addUser(userData: Omit<User, 'id'>): Observable<boolean> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', this.currentUser()?.id || '');

    // Resolve the appropriate login username for the backend
    let username = '';
    if (userData.role === 'Student') {
      username = userData.enrollmentNo || '';
    } else if (userData.role === 'Teacher') {
      username = userData.email || '';
    } else if (userData.role === 'Librarian') {
      username = userData.password || 'admin';
    }

    const backendUser = {
      username: username,
      role: userData.role.toUpperCase(),
      name: userData.name,
      email: userData.email
    };

    return this.http.post<any>('/api/librarian/users', backendUser, { headers }).pipe(
      switchMap(() => this.getUsersObservable()),
      map(users => {
        this.usersSignal.set(users);
        return true;
      }),
      catchError(err => {
        console.error('Failed to add user via backend API', err);
        return throwError(() => err);
      })
    );
  }

  deleteUser(id: string): Observable<void> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', this.currentUser()?.id || '');

    return this.http.delete<void>(`/api/librarian/users/${id}`, { headers }).pipe(
      switchMap(() => this.getUsersObservable()),
      map(users => {
        this.usersSignal.set(users);
      }),
      catchError(err => {
        console.error(`Failed to delete user via backend API`, err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Get all registered users.
   */
  getUsers(): User[] {
    return this.users();
  }
}
