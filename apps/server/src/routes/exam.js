import { Router } from "express";
import ExamModel from "../models/Exam.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";

const examRouter = Router();

examRouter.get("/", isAuthenticated, async (req, res) => {
  try {
    const check = req.user.email.split("@");
    const exams = await ExamModel.find({
      whitelist: check[0],
    });
    res.json({ exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

examRouter.post("/create", isAuthenticated, async (req, res) => {
  try {
    const { examName, accessKey, whitelist, pdfList, testcaseList } = req.body;
    const whitelistHandle = whitelist.split(", ");
    const pdfListHandle = pdfList.split(", ");
    const newExam = new ExamModel({
      examName,
      accessKey,
      whitelist: whitelistHandle,
      pdfList: pdfListHandle,
      testcaseList,
    });
    await newExam.save();
    res.status(201).json({ exam: newExam });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default examRouter;
