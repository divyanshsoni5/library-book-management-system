import { Component, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html'
})
export class LoginComponent {
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  selectedRole = signal<'Student' | 'Teacher' | 'Librarian'>('Student');
  identifierInput = '';
  errorMessage = '';

  selectRole(role: 'Student' | 'Teacher' | 'Librarian'): void {
    this.selectedRole.set(role);
    this.identifierInput = '';
    this.errorMessage = '';
  }

  onSubmit(): void {
    this.errorMessage = '';
    if (!this.identifierInput.trim()) {
      this.errorMessage = 'Please enter your unique ID / password.';
      return;
    }

    this.userService.login(this.selectedRole(), this.identifierInput).subscribe({
      next: (success) => {
        if (!success) {
          if (this.selectedRole() === 'Librarian') {
            this.errorMessage = 'Invalid Librarian Password. Use: librarian1';
          } else {
            this.errorMessage = `Invalid credentials for ${this.selectedRole()}.`;
          }
          this.cdr.detectChanges();
        }
      },
      error: (err: HttpErrorResponse) => {
        console.log('Login error response body:', err.error);
        if (err.status === 0) {
          this.errorMessage = '⚠️ Cannot connect to server. Make sure the backend is running on port 8082.';
        } else if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else {
          this.errorMessage = err.message || 'Login failed. Please try again.';
        }
        console.log('Assigned errorMessage:', this.errorMessage);
        this.cdr.detectChanges();
      }
    });
  }
}
