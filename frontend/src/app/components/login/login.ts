import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

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

    const success = this.userService.login(this.selectedRole(), this.identifierInput);
    if (!success) {
      if (this.selectedRole() === 'Librarian') {
        this.errorMessage = 'Invalid Librarian Password. Please try again.';
      } else {
        this.errorMessage = `Invalid ID for ${this.selectedRole()}. Check the list below for valid IDs.`;
      }
    }
  }
}
