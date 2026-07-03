import { Component, inject, signal } from '@angular/core';
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
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.errorMessage = '⚠️ Cannot connect to server. Make sure the backend is running on port 8080.';
        } else {
          this.errorMessage = `Server error (${err.status}): ${err.message}`;
        }
      }
    });
  }
}
