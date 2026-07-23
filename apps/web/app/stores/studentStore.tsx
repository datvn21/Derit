import { create } from "zustand"

type Student = {
  studentID: string,
  studentName: string,
  studentAvatar: string
}

type Action = {
  setStudentID: (newSID: Student['studentID']) => void,
  setStudentName: (newSN: Student['studentName']) => void,
  setStudentAvatar: (newSA: Student['studentAvatar']) => void
}

export const useStudent = create<Student&Action>((set) => ({
  studentID: "",
  studentName: "",
  studentAvatar: "",
  setStudentID: (newSID) => set(() => ({studentID: newSID})),
  setStudentName: (newSN) => set(() => ({studentName: newSN})),
  setStudentAvatar: (newSA) => set(() => ({studentAvatar: newSA})),
}))