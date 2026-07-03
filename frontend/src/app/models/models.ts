export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  quantity: number;
  availableCopies: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Teacher' | 'Librarian';
  enrollmentNo?: string;
  teacherId?: string;
  password?: string;
}

export interface IssuedBook {
  id: string;
  userId: string;
  bookId: string;
  issueDate: string; // ISO string format YYYY-MM-DD
  dueDate: string;   // ISO string format YYYY-MM-DD
  returnDate?: string; // ISO string format when returned
  finePaid?: boolean;
  fineAmount?: number;
}
