export function getCurrentAcademicYear() {
  return String(new Date().getFullYear());
}

export function isAcademicYear(value: unknown) {
  const year = String(value ?? "").trim();
  if (!/^\d{4}$/.test(year)) return false;

  const numericYear = Number(year);
  const currentYear = new Date().getFullYear();

  return numericYear >= 2000 && numericYear <= currentYear + 1;
}

export function getAcademicYearOptions(selectedYear?: string | null) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, index) =>
    String(currentYear + 1 - index),
  );

  if (
    selectedYear &&
    isAcademicYear(selectedYear) &&
    !years.includes(selectedYear)
  ) {
    years.push(selectedYear);
  }

  return years.sort((a, b) => Number(b) - Number(a));
}

export function getClassroomAcademicYear(classroom: any) {
  if (isAcademicYear(classroom?.academicYear)) {
    return String(classroom.academicYear).trim();
  }

  if (classroom?.createdAt) {
    const createdYear = String(new Date(classroom.createdAt).getFullYear());
    if (isAcademicYear(createdYear)) return createdYear;
  }

  return getCurrentAcademicYear();
}
