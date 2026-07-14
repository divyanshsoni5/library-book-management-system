import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  private currentUserSignal = signal<User | null>(null);
  currentUser = this.currentUserSignal.asReadonly();

  constructor() {
    this.initSession();
  }

  /**
   * Load active user from localStorage if logged in.
   * Checks both the portal keys (sgsits_auth_user) and the local keys (lms_current_user).
   */
  private loadCurrentUser(): User | null {
    // 1. Try reading from the common portal authentication key
    const portalData = localStorage.getItem('sgsits_auth_user');
    if (portalData) {
      try {
        const parsed = JSON.parse(portalData);
        if (parsed && parsed.role) {
          const mappedRole = this.mapAuthRole(parsed.role, parsed.subRole || '');
          return {
            id: String(parsed.id),
            name: parsed.fullName || parsed.username,
            email: parsed.email || '',
            role: mappedRole,
            enrollmentNo: mappedRole === 'Student' ? parsed.username : undefined,
            facultyId: mappedRole === 'Faculty' ? parsed.username : undefined
          };
        }
      } catch (e) {
        console.error('Failed to parse portal user', e);
      }
    }

    // 2. Fallback to local storage key
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
   * Extract user and token from URL parameters or localStorage on startup.
   */
  private initSession(): void {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      const id = params.get('id');
      const username = params.get('username');
      const role = params.get('role');
      const subRole = params.get('subRole');
      const fullName = params.get('fullName');
      const email = params.get('email');

      let decoded: any = {};
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        decoded = JSON.parse(window.atob(base64));
      } catch (e) {
        console.warn('Could not decode JWT payload', e);
      }

      const valId = id || decoded.id || decoded.userId || decoded.sub || '1';
      const valUsername = username || decoded.username || decoded.sub || '';
      const valRole = role || decoded.role || decoded.roles || '';
      const valSubRole = subRole || decoded.subRole || decoded.sub_role || '';
      const valFullName = fullName || decoded.fullName || decoded.name || valUsername;
      const valEmail = email || decoded.email || '';

      // Determine the mapped role
      const mappedRole = this.mapAuthRole(valRole, valSubRole);

      const user: User = {
        id: String(valId),
        name: valFullName,
        email: valEmail,
        role: mappedRole,
        enrollmentNo: mappedRole === 'Student' ? valUsername : undefined,
        facultyId: mappedRole === 'Faculty' ? valUsername : undefined
      };

      // Save token and user details to localStorage under both portal and local keys
      localStorage.setItem('sgsits_auth_token', token);
      localStorage.setItem('sgsits_auth_user', JSON.stringify({
        id: Number(valId),
        username: valUsername,
        role: valRole,
        subRole: valSubRole,
        fullName: valFullName,
        email: valEmail
      }));
      localStorage.setItem('lms_auth_token', token);
      localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
      
      this.currentUserSignal.set(user);

      // Clean the URL query parameters so the token is not visible
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else {
      // Check localStorage fallback
      const savedUser = this.loadCurrentUser();
      const savedToken = this.getToken();
      if (savedUser && savedToken) {
        this.currentUserSignal.set(savedUser);
      } else {
        this.currentUserSignal.set(null);
        // Redirect to external login service
        this.redirectToLogin();
      }
    }

    // If we already have a logged in librarian, fetch all users on startup
    const user = this.currentUser();
    if (user && user.role === 'Librarian') {
      this.refreshUsers();
    }
  }

  /**
   * Helper method to map auth service roles to library roles.
   */
  private mapAuthRole(role: string, subRole: string): 'Student' | 'Faculty' | 'Librarian' {
    const r = (role || '').toUpperCase();
    const sr = (subRole || '').toUpperCase();

    // 1. STAFF with LIBRARIAN subRole, or ADMIN role maps to Librarian
    if ((r === 'STAFF' && sr === 'LIBRARIAN') || r === 'ADMIN') {
      return 'Librarian';
    }
    // 2. FACULTY or HEAD (HOD) maps to Faculty
    if (r === 'FACULTY' || r === 'HEAD') {
      return 'Faculty';
    }
    // 3. STUDENT maps to Student
    if (r === 'STUDENT') {
      return 'Student';
    }

    // Fallbacks
    if (sr.includes('LIBRARIAN')) return 'Librarian';
    if (r.includes('TEACHER') || r.includes('FACULTY') || r.includes('HEAD') || r.includes('HOD')) return 'Faculty';
    return 'Student';
  }

  private mapBackendUser(backendUser: any): User {
    let finalRole: 'Student' | 'Faculty' | 'Librarian' = 'Student';
    if (backendUser.role === 'LIBRARIAN') {
      finalRole = 'Librarian';
    } else if (backendUser.role === 'TEACHER' || backendUser.role === 'FACULTY' || backendUser.role === 'HEAD') {
      finalRole = 'Faculty';
    }
    return {
      id: `${backendUser.id}`,
      name: backendUser.name || backendUser.username,
      email: backendUser.email || (backendUser.role === 'LIBRARIAN' ? `${backendUser.username}@sgsits.ac.in` : `${backendUser.username}@student.com`),
      role: finalRole,
      enrollmentNo: backendUser.role === 'STUDENT' ? backendUser.username : undefined,
      facultyId: (backendUser.role === 'TEACHER' || backendUser.role === 'FACULTY' || backendUser.role === 'HEAD') ? backendUser.username : undefined
    };
  }

  /**
   * Returns the JWT token from localStorage.
   */
  getToken(): string | null {
    return localStorage.getItem('sgsits_auth_token') || localStorage.getItem('lms_auth_token');
  }

  /**
   * Redirects the browser to the external portal login page.
   * If running locally in dev mode (ports 4200/4201), redirects to port 4200.
   * If running behind the gateway (port 8080/80), redirects to gateway root path.
   */
  redirectToLogin(): void {
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('4200') || currentOrigin.includes('4201')) {
      // Dev environment: Redirect to the common portal UI running on port 4200
      window.location.href = 'http://localhost:4200/';
    } else {
      // Production/Gateway environment: Redirect to the gateway root URL (e.g. http://localhost:8080/)
      window.location.href = window.location.protocol + '//' + window.location.host + '/';
    }
  }

  /**
   * Stub login method for backward compatibility.
   */
  login(role: 'Student' | 'Faculty' | 'Librarian', identifier: string): Observable<boolean> {
    this.redirectToLogin();
    return of(false);
  }

  /**
   * Logout and clear session, then redirect to the auth service.
   */
  logout(): void {
    this.currentUserSignal.set(null);
    this.usersSignal.set([]);
    localStorage.removeItem(this.USER_STORAGE_KEY);
    localStorage.removeItem('lms_auth_token');
    localStorage.removeItem('sgsits_auth_token');
    localStorage.removeItem('sgsits_auth_user');
    this.redirectToLogin();
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
    } else if (userData.role === 'Faculty') {
      username = userData.email || '';
    } else if (userData.role === 'Librarian') {
      username = userData.password || 'admin';
    }

    const backendUser = {
      username: username,
      role: userData.role === 'Faculty' ? 'FACULTY' : userData.role.toUpperCase(),
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
