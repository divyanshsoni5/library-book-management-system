package com.librarymanagement.library_management.dto;

public class FineStatusDto {
    private Long studentId;
    private boolean hasPendingFine;
    private double totalFineAmount;

    public FineStatusDto() {
    }

    public FineStatusDto(Long studentId, boolean hasPendingFine, double totalFineAmount) {
        this.studentId = studentId;
        this.hasPendingFine = hasPendingFine;
        this.totalFineAmount = totalFineAmount;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public boolean isHasPendingFine() {
        return hasPendingFine;
    }

    public void setHasPendingFine(boolean hasPendingFine) {
        this.hasPendingFine = hasPendingFine;
    }

    public double getTotalFineAmount() {
        return totalFineAmount;
    }

    public void setTotalFineAmount(double totalFineAmount) {
        this.totalFineAmount = totalFineAmount;
    }
}
