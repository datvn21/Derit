import { create } from "zustand";

type Exam = {
  pdfList: string[],
  testcase: Object
}

type Action = {
  setPdfList: (newPL: Exam['pdfList']) => void,
  setTestcase: (newT: Exam['testcase']) => void
}

export const useExam = create<Exam&Action>((set) => ({
  pdfList: [],
  testcase: {},
  setPdfList: (newPL) => set(() => ({ pdfList: newPL })),
  setTestcase: (newT) => set(() => ({ testcase: newT })),
}))