package com.librarymanagement.library_management.dto;

public class ActiveIssueDto {
    private Long studentId;
    private boolean hasActiveIssue;

    public ActiveIssueDto() {
    }

    public ActiveIssueDto(Long studentId, boolean hasActiveIssue) {
        this.studentId = studentId;
        this.hasActiveIssue = hasActiveIssue;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public boolean isHasActiveIssue() {
        return hasActiveIssue;
    }

    public void setHasActiveIssue(boolean hasActiveIssue) {
        this.hasActiveIssue = hasActiveIssue;
    }
}
