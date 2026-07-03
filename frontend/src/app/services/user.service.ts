import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
    this.refreshUsers();
  }

  /**
   * Fetch registered users dynamically from the backend /api/users endpoint.
   * If it fails, falls back to a clean list of demo credentials to ensure the UI remains testable.
   */
  refreshUsers(): void {
    this.http.get<any[]>('/api/users').subscribe({
      next: (data) => {
        const mappedUsers: User[] = data.map(u => {
          let role: 'Student' | 'Teacher' | 'Librarian' = 'Student';
          const backendRole = u.role ? u.role.toUpperCase() : 'STUDENT';
          
          if (backendRole === 'LIBRARIAN') {
            role = 'Librarian';
          } else if (backendRole === 'TEACHER') {
            role = 'Teacher';
          }

          // Format names and emails according to college requirements
          const nameLower = u.username ? u.username.toLowerCase() : 'user';
          let email = '';
          let enrollmentNo = undefined;
          let teacherId = undefined;

          if (role === 'Student') {
            enrollmentNo = u.username;
            email = `${nameLower}@sgsits.ac.in`;
          } else {
            // For teachers and librarians
            email = `${nameLower}@sgsits.ac.in`;
            if (role === 'Teacher') {
              teacherId = email;
            }
          }

          return {
            id: String(u.id),
            name: u.username,
            email: email,
            role: role,
            enrollmentNo: enrollmentNo,
            teacherId: teacherId
          };
        });
        this.usersSignal.set(mappedUsers);
      },
      error: (err) => {
        console.warn('Failed to load users from backend /api/users. Using college fallback credentials for local login.', err);
        this.usersSignal.set([
          {
            id: '1',
            name: 'Sarah Jenkins',
            email: 'sarah_jenkins@sgsits.ac.in',
            role: 'Librarian',
            password: 'admin'
          },
          {
            id: '2',
            name: 'Aarav Sharma',
            email: '0801cs241001@sgsits.ac.in',
            role: 'Student',
            enrollmentNo: '0801CS241001'
          },
          {
            id: '3',
            name: 'Priya Patel',
            email: '0801cs241002@sgsits.ac.in',
            role: 'Student',
            enrollmentNo: '0801CS241002'
          }
        ]);
      }
    });
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

  /**
   * Login as a Student, Teacher, or Librarian.
   */
  login(role: 'Student' | 'Teacher' | 'Librarian', identifier: string): boolean {
    let matchedUser: User | undefined;
    const currentUsers = this.usersSignal();

    if (role === 'Student') {
      matchedUser = currentUsers.find(u => u.role === 'Student' && u.enrollmentNo === identifier.trim());
    } else if (role === 'Teacher') {
      matchedUser = currentUsers.find(u => u.role === 'Teacher' && u.email === identifier.trim().toLowerCase());
    } else if (role === 'Librarian') {
      // Allow 'admin' password or matching username
      matchedUser = currentUsers.find(u => u.role === 'Librarian' && (u.password === identifier.trim() || identifier.trim() === 'admin'));
    }

    if (matchedUser) {
      this.currentUserSignal.set(matchedUser);
      localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(matchedUser));
      return true;
    }
    return false;
  }

  /**
   * Logout and clear session.
   */
  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem(this.USER_STORAGE_KEY);
  }

  /**
   * Get all registered users (for dropdowns / user tables).
   */
  getUsers(): User[] {
    return this.usersSignal();
  }

  /**
   * Add a new user via API with fallback local caching.
   */
  addUser(userData: Omit<User, 'id'>): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };

    const backendUser = {
      username: userData.name,
      role: userData.role.toUpperCase()
    };

    this.http.post<any>('/api/librarian/users', backendUser, { headers }).subscribe({
      next: () => {
        this.refreshUsers();
      },
      error: (err) => {
        console.warn('Backend POST /api/librarian/users not implemented yet. Adding user to local state.', err);
        const nextId = String(Math.max(...this.usersSignal().map(u => Number(u.id) || 0), 0) + 1);
        const newUser: User = {
          ...userData,
          id: nextId
        };
        this.usersSignal.set([...this.usersSignal(), newUser]);
      }
    });
  }

  /**
   * Delete a user via API with fallback local caching.
   */
  deleteUser(id: string): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };

    this.http.delete<void>(`/api/librarian/users/${id}`, { headers }).subscribe({
      next: () => {
        this.refreshUsers();
      },
      error: (err) => {
        console.warn(`Backend DELETE /api/librarian/users/${id} not implemented yet. Deleting user from local state.`, err);
        const updated = this.usersSignal().filter(u => u.id !== id);
        this.usersSignal.set(updated);
      }
    });
  }
}
