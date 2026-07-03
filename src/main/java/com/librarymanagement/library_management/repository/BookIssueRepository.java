package com.librarymanagement.library_management.repository;

import com.librarymanagement.library_management.model.BookIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BookIssueRepository extends JpaRepository<BookIssue, Long> {
    List<BookIssue> findByStudentIdAndReturnDateIsNull(Long studentId);
    
    Optional<BookIssue> findByBookIdAndStudentIdAndReturnDateIsNull(Long bookId, Long studentId);
}
