import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { User } from '../../models/models';

interface UserForm {
  name: string;
  email: string;
  role: 'Student' | 'Teacher' | 'Librarian';
  enrollmentNo?: string;
  teacherId?: string;
  password?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html'
})
export class UsersComponent {
  userService = inject(UserService);
  currentUser = this.userService.currentUser;

  // Modal controls
  isModalOpen = false;
  
  // Form model
  userForm: UserForm = {
    name: '',
    email: '',
    role: 'Student',
    enrollmentNo: '',
    teacherId: '',
    password: ''
  };

  openModal(): void {
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  resetForm(): void {
    this.userForm = {
      name: '',
      email: '',
      role: 'Student',
      enrollmentNo: '',
      teacherId: '',
      password: ''
    };
  }

  onRoleChange(): void {
    // Reset specific fields when role toggles
    this.userForm.enrollmentNo = '';
    this.userForm.teacherId = '';
    this.userForm.password = '';
  }

  onSubmit(): void {
    if (!this.userForm.name.trim()) return;

    // Apply college specific email formats dynamically
    const nameLower = this.userForm.name.trim().toLowerCase().replace(/\s+/g, '_');
    let finalEmail = '';
    let finalEnrollment = undefined;
    let finalTeacherId = undefined;
    let finalPassword = undefined;

    if (this.userForm.role === 'Student') {
      const enrollment = this.userForm.enrollmentNo?.trim().toUpperCase() || '0801CS241000';
      finalEnrollment = enrollment;
      finalEmail = `${enrollment.toLowerCase()}@sgsits.ac.in`;
    } else {
      finalEmail = `${nameLower}@sgsits.ac.in`;
      if (this.userForm.role === 'Teacher') {
        finalTeacherId = finalEmail;
      } else if (this.userForm.role === 'Librarian') {
        finalPassword = this.userForm.password?.trim() || 'admin';
      }
    }

    const newUserPayload: Omit<User, 'id'> = {
      name: this.userForm.name.trim(),
      email: finalEmail,
      role: this.userForm.role,
      enrollmentNo: finalEnrollment,
      teacherId: finalTeacherId,
      password: finalPassword
    };

    this.userService.addUser(newUserPayload);
    this.closeModal();
  }

  onDeleteUser(id: string): void {
    if (confirm('Are you sure you want to remove this library member?')) {
      this.userService.deleteUser(id);
    }
  }
}
