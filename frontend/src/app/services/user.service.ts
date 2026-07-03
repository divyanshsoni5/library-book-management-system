import { Injectable, signal } from '@angular/core';
import { User } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly USER_STORAGE_KEY = 'lms_current_user';
  
  // Default mock users
  private readonly defaultUsers: User[] = [
    {
      id: 'user-1',
      name: 'Aarav Sharma',
      email: '0801CS241001@sgsits.ac.in',
      role: 'Student',
      enrollmentNo: '0801CS241001'
    },
    {
      id: 'user-2',
      name: 'Priya Patel',
      email: '0801CS241002@sgsits.ac.in',
      role: 'Student',
      enrollmentNo: '0801CS241002'
    },
    {
      id: 'user-3',
      name: 'Aditya Verma',
      email: '0801CS241003@sgsits.ac.in',
      role: 'Student',
      enrollmentNo: '0801CS241003'
    },
    {
      id: 'user-4',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@sgsits.ac.in',
      role: 'Teacher',
      teacherId: 'rajesh.kumar@sgsits.ac.in'
    },
    {
      id: 'user-5',
      name: 'Meera Nair',
      email: 'meera.nair@sgsits.ac.in',
      role: 'Teacher',
      teacherId: 'meera.nair@sgsits.ac.in'
    },
    {
      id: 'user-6',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@sgsits.ac.in',
      role: 'Librarian',
      password: 'admin'
    }
  ];

  private usersSignal = signal<User[]>(this.defaultUsers);
  users = this.usersSignal.asReadonly();

  // Writable signal for current logged in user
  private currentUserSignal = signal<User | null>(this.loadCurrentUser());
  currentUser = this.currentUserSignal.asReadonly();

  constructor() {}

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

    if (role === 'Student') {
      matchedUser = this.defaultUsers.find(u => u.role === 'Student' && u.enrollmentNo === identifier.trim());
    } else if (role === 'Teacher') {
      matchedUser = this.defaultUsers.find(u => u.role === 'Teacher' && u.email === identifier.trim().toLowerCase());
    } else if (role === 'Librarian') {
      matchedUser = this.defaultUsers.find(u => u.role === 'Librarian' && u.password === identifier.trim());
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
    return this.defaultUsers;
  }
}
