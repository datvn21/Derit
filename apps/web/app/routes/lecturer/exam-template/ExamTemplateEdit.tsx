import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { examTemplateAPI, uploadAPI } from "~/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  FileText,
  Code,
  Download,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface StarterFile {
  name: string;
  content: string;
  canDownload?: boolean;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  testFile?: { name: string; content: string };
  extraFiles?: { name: string; content: string }[];
}

interface Question {
  questionNumber: number;
  title: string;
  testCases: TestCase[];
  starterFiles: StarterFile[];
  defaultMainFile?: string;
}

interface ExamCode {
  codeNumber: string;
  pdfUrl: string;
  pdfFile?: File | null;
  questions: Question[];
}

export default function ExamTemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCodeIndex, setActiveCodeIndex] = useState(0);
  const hasInitializedRef = useRef(false);

  //PDF preview
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

  //File preview
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  // Template basic info
  const [templateName, setTemplateName] = useState("");
  const [examType, setExamType] = useState<"OOP" | "DSA" | "General">("OOP");
  const [language, setLanguage] = useState("java");
  const [duration, setDuration] = useState(120);

  // Exam codes
  const [examCodes, setExamCodes] = useState<ExamCode[]>([]);

  // Load existing template
  const { data: templateData, isLoading } = useQuery({
    queryKey: ["exam-template", id],
    queryFn: () => examTemplateAPI.getById(id!),
    enabled: !!id,
  });

  // Fill form when data loads
  useEffect(() => {
    if (templateData?.data?.template && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const template = templateData.data.template;

      setTemplateName(template.templateName);
      setExamType(template.examType);
      setLanguage(template.language);
      setDuration(template.duration);

      // Map exam codes from template
      setExamCodes(
        template.examCodes.map((code: any) => ({
          codeNumber: code.codeNumber,
          pdfUrl: code.pdfUrl,
          pdfFile: null,
          questions: code.questions.map((q: any) => ({
            questionNumber: q.questionNumber,
            title: q.title || "",
            testCases: q.testCases.map((tc: any) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
              testFile: tc.testFile?.content
                ? { name: tc.testFile.name, content: tc.testFile.content }
                : undefined,
              extraFiles: (tc.extraFiles ?? []).map((ef: any) => ({
                name: ef.name,
                content: ef.content,
              })),
            })),
            starterFiles: (q.starterFiles ?? []).map((sf: any) => ({
              name: sf.name,
              content: sf.content,
              canDownload: sf.canDownload ?? false,
            })),
            defaultMainFile: q.defaultMainFile || undefined,
          })),
        })),
      );
    }
  }, [templateData]);

  const handleDrop = (
    e: React.DragEvent<HTMLElement>,
    codeIndex: number,
    questionIndex: number,
  ) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => addStarterFile(codeIndex, questionIndex, file));
  };

  const getPdfPreviewUrl = (code: ExamCode) => {
    if (code.pdfFile) {
      return URL.createObjectURL(code.pdfFile);
    }
    return `${import.meta.env.DEV ? import.meta.env.VITE_DEV_BACKEND_URL : import.meta.env.VITE_BACKEND_URL}${code.pdfUrl}`;
  };

  // Auto-set language based on exam type
  const handleExamTypeChange = (type: "OOP" | "DSA" | "General") => {
    setExamType(type);
    if (type === "OOP" || type === "DSA") {
      setLanguage("java");
    }
  };

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => examTemplateAPI.update(id!, data),
    onSuccess: () => {
      toast.success("Template updated successfully");
      navigate("/lecturer/exam-templates");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update template");
      setIsSubmitting(false);
    },
  });

  const handleFileSelect = (codeIndex: number, file: File) => {
    const newCodes = [...examCodes];
    newCodes[codeIndex].pdfFile = file;
    newCodes[codeIndex].pdfUrl = "";
    setExamCodes(newCodes);
  };

  const addExamCode = () => {
    const nextNumber =
      examCodes.length > 0
        ? (parseInt(examCodes[examCodes.length - 1].codeNumber) + 1).toString()
        : "101";
    setExamCodes((prev) => [
      ...prev,
      {
        codeNumber: nextNumber,
        pdfUrl: "",
        pdfFile: null,
        questions: [
          {
            questionNumber: 1,
            title: "",
            testCases: [
              {
                input: "",
                expectedOutput: "",
                isHidden: false,
                extraFiles: [],
              },
            ],
            starterFiles: [],
          },
        ],
      },
    ]);
    setActiveCodeIndex(examCodes.length);
  };

  const removeExamCode = (index: number) => {
    if (examCodes.length > 1) {
      const targetCode = examCodes[index]?.codeNumber || `${index + 1}`;
      const shouldRemove = window.confirm(
        `Delete exam code ${targetCode}? All questions and test cases inside this code will be removed.`,
      );

      if (!shouldRemove) {
        return;
      }

      setExamCodes(examCodes.filter((_, i) => i !== index));
      setActiveCodeIndex((prev) => Math.min(prev, examCodes.length - 2));
    }
  };

  const addQuestion = (codeIndex: number) => {
    const newCodes = [...examCodes];
    const nextQuestionNumber = newCodes[codeIndex].questions.length + 1;
    newCodes[codeIndex].questions.push({
      questionNumber: nextQuestionNumber,
      title: "",
      testCases: [
        { input: "", expectedOutput: "", isHidden: false, extraFiles: [] },
      ],
      starterFiles: [],
    });
    setExamCodes(newCodes);
  };

  const removeQuestion = (codeIndex: number, questionIndex: number) => {
    const newCodes = [...examCodes];
    if (newCodes[codeIndex].questions.length > 1) {
      const targetQuestion =
        newCodes[codeIndex].questions[questionIndex]?.questionNumber ||
        questionIndex + 1;
      const shouldRemove = window.confirm(
        `Delete question ${targetQuestion} in code ${newCodes[codeIndex].codeNumber}?`,
      );

      if (!shouldRemove) {
        return;
      }

      newCodes[codeIndex].questions.splice(questionIndex, 1);
      newCodes[codeIndex].questions.forEach((q, i) => {
        q.questionNumber = i + 1;
      });
      setExamCodes(newCodes);
    }
  };

  const addStarterFile = (
    codeIndex: number,
    questionIndex: number,
    file: File,
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        starterFiles: [
                          ...q.starterFiles,
                          { name: file.name, content, canDownload: false },
                        ],
                      },
                ),
              },
        ),
      );
    };
    reader.readAsText(file);
  };

  const toggleStarterFileDownload = (
    codeIndex: number,
    questionIndex: number,
    fileIndex: number,
  ) => {
    setExamCodes((prev) =>
      prev.map((code, ci) =>
        ci !== codeIndex
          ? code
          : {
              ...code,
              questions: code.questions.map((q, qi) =>
                qi !== questionIndex
                  ? q
                  : {
                      ...q,
                      starterFiles: q.starterFiles.map((sf, i) =>
                        i === fileIndex
                          ? { ...sf, canDownload: !sf.canDownload }
                          : sf,
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setDefaultMainFile = (
    codeIndex: number,
    questionIndex: number,
    fileName: string,
  ) => {
    setExamCodes((prev) =>
      prev.map((code, ci) =>
        ci !== codeIndex
          ? code
          : {
              ...code,
              questions: code.questions.map((q, qi) =>
                qi !== questionIndex
                  ? q
                  : {
                      ...q,
                      defaultMainFile:
                        q.defaultMainFile === fileName ? undefined : fileName,
                    },
              ),
            },
      ),
    );
  };

  const removeStarterFile = (
    codeIndex: number,
    questionIndex: number,
    fileIndex: number,
  ) => {
    setExamCodes((prev) =>
      prev.map((code, ci) =>
        ci !== codeIndex
          ? code
          : {
              ...code,
              questions: code.questions.map((q, qi) => {
                if (qi !== questionIndex) return q;
                const removedName = q.starterFiles[fileIndex]?.name;
                return {
                  ...q,
                  starterFiles: q.starterFiles.filter(
                    (_, i) => i !== fileIndex,
                  ),
                  defaultMainFile:
                    q.defaultMainFile === removedName
                      ? undefined
                      : q.defaultMainFile,
                };
              }),
            },
      ),
    );
  };

  const addTestCase = (codeIndex: number, questionIndex: number) => {
    const newCodes = [...examCodes];
    const question = newCodes[codeIndex].questions[questionIndex];

    question.testCases.push({
      input: "",
      expectedOutput: "",
      isHidden: false,
      extraFiles: [],
    });
    setExamCodes(newCodes);
  };

  const removeTestCase = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
  ) => {
    const newCodes = [...examCodes];
    const question = newCodes[codeIndex].questions[questionIndex];

    if (question.testCases.length > 1) {
      question.testCases.splice(testCaseIndex, 1);
      setExamCodes(newCodes);
    }
  };

  const setTestCaseFile = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
    file: File,
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        testCases: q.testCases.map((tc, ti) =>
                          ti !== testCaseIndex
                            ? tc
                            : { ...tc, testFile: { name: file.name, content } },
                        ),
                      },
                ),
              },
        ),
      );
    };
    reader.readAsText(file);
  };

  const removeTestCaseFile = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
  ) => {
    setExamCodes((prev) =>
      prev.map((code, ci) =>
        ci !== codeIndex
          ? code
          : {
              ...code,
              questions: code.questions.map((q, qi) =>
                qi !== questionIndex
                  ? q
                  : {
                      ...q,
                      testCases: q.testCases.map((tc, ti) =>
                        ti !== testCaseIndex
                          ? tc
                          : { ...tc, testFile: undefined },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const addExtraFile = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
    file: File,
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setExamCodes((prev) =>
        prev.map((code, ci) =>
          ci !== codeIndex
            ? code
            : {
                ...code,
                questions: code.questions.map((q, qi) =>
                  qi !== questionIndex
                    ? q
                    : {
                        ...q,
                        testCases: q.testCases.map((tc, ti) =>
                          ti !== testCaseIndex
                            ? tc
                            : {
                                ...tc,
                                extraFiles: [
                                  ...(tc.extraFiles ?? []).filter(
                                    (ef) => ef.name !== file.name,
                                  ),
                                  { name: file.name, content },
                                ],
                              },
                        ),
                      },
                ),
              },
        ),
      );
    };
    reader.readAsText(file);
  };

  const removeExtraFile = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
    fileName: string,
  ) => {
    setExamCodes((prev) =>
      prev.map((code, ci) =>
        ci !== codeIndex
          ? code
          : {
              ...code,
              questions: code.questions.map((q, qi) =>
                qi !== questionIndex
                  ? q
                  : {
                      ...q,
                      testCases: q.testCases.map((tc, ti) =>
                        ti !== testCaseIndex
                          ? tc
                          : {
                              ...tc,
                              extraFiles: (tc.extraFiles ?? []).filter(
                                (ef) => ef.name !== fileName,
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const updateExamCode = (index: number, field: keyof ExamCode, value: any) => {
    const newCodes = [...examCodes];
    (newCodes[index] as any)[field] = value;
    setExamCodes(newCodes);
  };

  const updateQuestion = (
    codeIndex: number,
    questionIndex: number,
    field: keyof Question,
    value: any,
  ) => {
    const newCodes = [...examCodes];
    (newCodes[codeIndex].questions[questionIndex] as any)[field] = value;
    setExamCodes(newCodes);
  };

  const updateTestCase = (
    codeIndex: number,
    questionIndex: number,
    testCaseIndex: number,
    field: keyof TestCase,
    value: any,
  ) => {
    const newCodes = [...examCodes];
    (
      newCodes[codeIndex].questions[questionIndex].testCases[
        testCaseIndex
      ] as any
    )[field] = value;
    setExamCodes(newCodes);
  };

  const handleSubmit = async () => {
    try {
      if (!templateName.trim()) {
        toast.error("Please enter template name");
        return;
      }

      if (examCodes.length === 0) {
        toast.error("At least one exam code is required");
        return;
      }

      // Check if file is selected OR url exists for all codes
      if (examCodes.some((code) => !code.pdfFile && !code.pdfUrl)) {
        toast.error("Please select a PDF file for all exam codes");
        return;
      }

      setIsSubmitting(true);

      // Upload new PDFs in parallel (if any pending files)
      const processedExamCodes = [...examCodes];

      const uploadPromises = processedExamCodes.map(async (code, i) => {
        if (!code.pdfFile) {
          return { index: i, url: code.pdfUrl };
        }

        // Retry logic
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            toast.loading(
              `Uploading PDF for code ${code.codeNumber}... (${attempt}/${maxRetries})`,
              {
                id: `upload-${code.codeNumber}`,
              },
            );

            const response = await uploadAPI.uploadPdf(
              code.pdfFile,
              (progress) => {
                toast.loading(
                  `Uploading PDF for code ${code.codeNumber}... ${progress}%`,
                  { id: `upload-${code.codeNumber}` },
                );
              },
            );

            toast.success(`PDF for code ${code.codeNumber} uploaded`, {
              id: `upload-${code.codeNumber}`,
            });

            return { index: i, url: response.data.url };
          } catch (err: any) {
            lastError = err;
            console.error(
              `Upload attempt ${attempt} failed for code ${code.codeNumber}:`,
              err,
            );

            if (attempt === maxRetries) {
              toast.error(
                `Failed to upload PDF for code ${code.codeNumber}: ${err.response?.data?.error || err.message || "Unknown error"}`,
                { id: `upload-${code.codeNumber}` },
              );
              throw err;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }

        throw lastError;
      });

      try {
        const uploadResults = await Promise.all(uploadPromises);

        uploadResults.forEach(({ index, url }) => {
          processedExamCodes[index].pdfUrl = url;
        });
      } catch (err: any) {
        console.error("Upload failed:", err);
        setIsSubmitting(false);
        return;
      }

      // Update Template
      const data = {
        templateName,
        examType,
        language,
        duration,
        examCodes: processedExamCodes.map((c) => ({
          codeNumber: c.codeNumber,
          pdfUrl: c.pdfUrl,
          questions: c.questions,
        })),
      };

      updateMutation.mutate(data);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
      toast.error("An unexpected error occurred");
    }
  };

  const code = examCodes[activeCodeIndex];
  const codeIndex = activeCodeIndex;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!templateData?.data?.template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Template not found</p>
          <Button onClick={() => navigate("/lecturer/exam-templates")}>
            Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/lecturer/exam-templates")}
                className="text-gray-600 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">
                Edit Exam Template
              </h1>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/80 text-white cursor-pointer"
            >
              {isSubmitting ? "Updating..." : "Update Template"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Template Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Template Information
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., OOP Midterm 2024"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="examType">Exam Type</Label>
              <Select
                value={examType}
                onValueChange={(v) => handleExamTypeChange(v as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OOP">OOP</SelectItem>
                  <SelectItem value="DSA">DSA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={examType === "OOP" || examType === "DSA"}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="java">Java</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* ── Exam Codes Tabs ── */}
        <div className="space-y-0">
          {/* Tab bar */}
          <div className="flex items-end gap-1 overflow-x-auto pb-0">
            {examCodes.map((code: ExamCode, ci: number) => (
              <div key={ci} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveCodeIndex(ci)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors cursor-pointer ${
                    ci === activeCodeIndex
                      ? "bg-white text-blue-700 border-gray-200"
                      : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
                  }`}
                >
                  <span>Code {code.codeNumber}</span>
                  {examCodes.length > 1 && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExamCode(ci);
                      }}
                      className="flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer text-xs leading-none"
                    >
                      ×
                    </span>
                  )}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addExamCode}
              className="px-3 py-2 text-sm text-gray-400 hover:text-primary hover:bg-gray-100 rounded-t-lg cursor-pointer transition-colors shrink-0"
              title="Thêm mã đề"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Active exam code panel */}
          {code && (
            <div className="bg-white rounded-b-lg rounded-tr-lg border border-gray-200 p-6">
              {/* Code Number & PDF Upload */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label>Code Number</Label>
                  <Input
                    value={code.codeNumber}
                    onChange={(e) =>
                      updateExamCode(codeIndex, "codeNumber", e.target.value)
                    }
                    placeholder="101"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Upload PDF</Label>
                  <div className="mt-1">
                    <label className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        {code.pdfFile
                          ? code.pdfFile.name
                          : code.pdfUrl
                            ? "Change PDF"
                            : "Select PDF"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(codeIndex, file);
                        }}
                      />
                    </label>
                    {(code.pdfUrl || code.pdfFile) && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = getPdfPreviewUrl(code);
                          if (url) setPreviewPdf(url);
                        }}
                        className="text-xs mt-2 flex items-center gap-1 text-primary hover:underline cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        {code.pdfFile
                          ? "Preview selected PDF"
                          : "Preview current PDF"}
                      </button>
                    )}
                  </div>
                </div>
                <Dialog
                  open={!!previewPdf}
                  onOpenChange={() => setPreviewPdf(null)}
                >
                  <DialogContent
                    showCloseButton={false}
                    className="!max-w-none w-[90vw] h-[90vh] p-0 pb-2 gap-0"
                  >
                    <DialogTitle></DialogTitle>
                    <div className="h-[85vh]">
                      {previewPdf && (
                        <iframe
                          src={previewPdf}
                          className="w-full h-full rounded-t-md"
                          title="PDF Preview"
                        />
                      )}
                    </div>

                    <DialogFooter className="h-[5vh] flex items-center border-t border-black">
                      <DialogClose asChild>
                        <Button
                          className="cursor-pointer mr-6"
                          variant="outline"
                        >
                          Close
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Questions</Label>
                  <Button
                    onClick={() => addQuestion(codeIndex)}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Question
                  </Button>
                </div>

                {code.questions.map((question, questionIndex) => (
                  <div
                    key={questionIndex}
                    id={`exam-code-${codeIndex}-q-${questionIndex}`}
                    className="bg-gray-50 rounded-lg p-4 space-y-4 scroll-mt-6"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-700">
                        Question {question.questionNumber}
                      </h4>
                      {code.questions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeQuestion(codeIndex, questionIndex)
                          }
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Starter Files */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-gray-500" />
                          File có sẵn cho sinh viên
                        </Label>
                        <label className="cursor-pointer">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="cursor-pointer pointer-events-none"
                          >
                            <span>
                              <Plus className="w-3 h-3 mr-1" />
                              Thêm file
                            </span>
                          </Button>
                          <input
                            type="file"
                            accept=".java,.py,.js,.ts,.c,.cpp,.h,.txt,.inp"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              Array.from(e.target.files ?? []).forEach((f) =>
                                addStarterFile(codeIndex, questionIndex, f),
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {question.starterFiles.length === 0 ? (
                        <label
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) =>
                            handleDrop(e, codeIndex, questionIndex)
                          }
                          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500 
                                    hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer block"
                        >
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="font-medium">Drag & drop files here</p>
                          <p className="text-xs mt-1">
                            or click to select files
                          </p>

                          <input
                            type="file"
                            accept=".java,.py,.js,.ts,.c,.cpp,.h,.txt,.inp"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              Array.from(e.target.files ?? []).forEach((f) =>
                                addStarterFile(codeIndex, questionIndex, f),
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {question.starterFiles.map((sf, sfIdx) => (
                            <div
                              key={sfIdx}
                              className="flex items-center gap-1.5 bg-white border border-gray-200 
                                        rounded px-2 py-1 text-xs text-gray-700 cursor-pointer 
                                        hover:bg-blue-50 transition"
                              onClick={() => setPreviewFile(sf)}
                            >
                              <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="max-w-35 truncate">
                                {sf.name}
                              </span>

                              <button
                                type="button"
                                title={
                                  question.defaultMainFile === sf.name
                                    ? "Default entry file (click to unset)"
                                    : "Set as default entry file"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDefaultMainFile(
                                    codeIndex,
                                    questionIndex,
                                    sf.name,
                                  );
                                }}
                                className={`ml-0.5 cursor-pointer ${question.defaultMainFile === sf.name ? "text-yellow-500 hover:text-yellow-600" : "text-gray-300 hover:text-yellow-400"}`}
                              >
                                <Star
                                  className="w-3 h-3"
                                  fill={
                                    question.defaultMainFile === sf.name
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                title={
                                  sf.canDownload
                                    ? "Students can download"
                                    : "Students cannot download"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarterFileDownload(
                                    codeIndex,
                                    questionIndex,
                                    sfIdx,
                                  );
                                }}
                                className={`ml-0.5 cursor-pointer ${sf.canDownload ? "text-green-500 hover:text-green-700" : "text-gray-300 hover:text-green-400"}`}
                              >
                                <Download className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation(); // Stop open preview when trigger delete
                                  removeStarterFile(
                                    codeIndex,
                                    questionIndex,
                                    sfIdx,
                                  );
                                }}
                                className="text-gray-400 hover:text-red-500 ml-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          {/* Add more file button */}
                          <label className="border border-dashed border-gray-300 rounded px-3 py-1 text-xs cursor-pointer hover:bg-gray-50">
                            + Add more
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              accept=".java,.py,.js,.ts,.c,.cpp,.h,.txt,.inp"
                              onChange={(e) => {
                                Array.from(e.target.files ?? []).forEach((f) =>
                                  addStarterFile(codeIndex, questionIndex, f),
                                );
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      )}
                      <Dialog
                        open={!!previewFile}
                        onOpenChange={() => setPreviewFile(null)}
                      >
                        <DialogContent
                          showCloseButton={false}
                          className="max-w-4xl max-h-[80vh] overflow-hidden"
                        >
                          <DialogHeader>
                            <DialogTitle>{previewFile?.name}</DialogTitle>
                          </DialogHeader>

                          <div className="overflow-auto bg-gray-900 text-gray-100 text-sm p-4 rounded-md max-h-[60vh]">
                            <pre className="whitespace-pre-wrap break-words">
                              {previewFile?.content}
                            </pre>
                          </div>

                          <DialogFooter>
                            <DialogClose asChild>
                              <Button
                                className="cursor-pointer"
                                variant="outline"
                              >
                                Close
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Test Cases */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Test Cases</Label>
                        <Button
                          onClick={() => addTestCase(codeIndex, questionIndex)}
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Test Case
                        </Button>
                      </div>

                      {question.testCases.map((testCase, testCaseIndex) => (
                        <div
                          key={testCaseIndex}
                          className="bg-white rounded border border-gray-200 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">
                              Test Case {testCaseIndex + 1}
                            </span>
                            {question.testCases.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeTestCase(
                                    codeIndex,
                                    questionIndex,
                                    testCaseIndex,
                                  )
                                }
                                className="h-6 w-6 p-0 text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Input</Label>
                              <Textarea
                                value={testCase.input}
                                onChange={(e) =>
                                  updateTestCase(
                                    codeIndex,
                                    questionIndex,
                                    testCaseIndex,
                                    "input",
                                    e.target.value,
                                  )
                                }
                                placeholder="5"
                                className="mt-1 text-sm font-mono resize-y"
                                rows={3}
                              />
                            </div>

                            <div>
                              <Label className="text-xs">Expected Output</Label>
                              <Textarea
                                value={testCase.expectedOutput}
                                onChange={(e) =>
                                  updateTestCase(
                                    codeIndex,
                                    questionIndex,
                                    testCaseIndex,
                                    "expectedOutput",
                                    e.target.value,
                                  )
                                }
                                placeholder="120"
                                className="mt-1 text-sm font-mono resize-y"
                                rows={3}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={testCase.isHidden}
                              onChange={(e) =>
                                updateTestCase(
                                  codeIndex,
                                  questionIndex,
                                  testCaseIndex,
                                  "isHidden",
                                  e.target.checked,
                                )
                              }
                              className="rounded"
                            />
                            <Label className="text-xs text-gray-600">
                              Hidden test case
                            </Label>
                          </div>

                          {/* Test file (grader injected server-side) */}
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500 w-20 shrink-0">
                              Test file:
                            </Label>
                            {testCase.testFile ? (
                              <div
                                className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded px-2 py-0.5 text-xs text-orange-700 cursor-pointer hover:bg-orange-100 transition"
                                onClick={() =>
                                  setPreviewFile(testCase.testFile!)
                                }
                              >
                                <FileText className="w-3 h-3 text-orange-500" />
                                <span className="truncate max-w-32">
                                  {testCase.testFile.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTestCaseFile(
                                      codeIndex,
                                      questionIndex,
                                      testCaseIndex,
                                    );
                                  }}
                                  className="text-gray-400 hover:text-red-500 ml-0.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1 px-2 py-0.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 cursor-pointer hover:bg-gray-50 hover:border-gray-400">
                                <Upload className="w-3 h-3" />
                                Upload Test{testCaseIndex + 1}.java
                                <input
                                  type="file"
                                  accept=".java,.py"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f)
                                      setTestCaseFile(
                                        codeIndex,
                                        questionIndex,
                                        testCaseIndex,
                                        f,
                                      );
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          {/* Extra files */}
                          <div className="flex items-start gap-2">
                            <Label className="text-xs text-gray-500 w-20 shrink-0 pt-0.5">
                              Extra files:
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                              {(testCase.extraFiles ?? []).map((ef) => (
                                <div
                                  key={ef.name}
                                  className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-xs text-blue-700 cursor-pointer hover:bg-blue-100 transition"
                                  onClick={() => setPreviewFile(ef)}
                                >
                                  <FileText className="w-3 h-3 text-blue-500" />
                                  <span className="truncate max-w-28">
                                    {ef.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeExtraFile(
                                        codeIndex,
                                        questionIndex,
                                        testCaseIndex,
                                        ef.name,
                                      );
                                    }}
                                    className="text-gray-400 hover:text-red-500 ml-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <label className="flex items-center gap-1 px-2 py-0.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 cursor-pointer hover:bg-gray-50 hover:border-gray-400">
                                <Upload className="w-3 h-3" />
                                Add file
                                <input
                                  type="file"
                                  accept=".java,.py,.txt,.inp,.csv,.json,.xml,.dat"
                                  className="hidden"
                                  multiple
                                  onChange={(e) => {
                                    Array.from(e.target.files ?? []).forEach(
                                      (f) =>
                                        addExtraFile(
                                          codeIndex,
                                          questionIndex,
                                          testCaseIndex,
                                          f,
                                        ),
                                    );
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* end tabs */}
      </div>
    </div>
  );
}
