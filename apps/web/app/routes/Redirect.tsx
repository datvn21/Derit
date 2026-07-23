import { useEffect } from "react"
import { useSearchParams } from "react-router";
import { create } from "zustand";

type Lecturer = {
  lecturerGmail:string
}

type Action = {
  setLecturerGmail: (newLGmail: Lecturer['lecturerGmail']) => void
}

const uselecturer = create<Lecturer&Action>((set) => ({
  lecturerGmail: "",
  setLecturerGmail: (newLGmail) => set(() => ({lecturerGmail: newLGmail}))
}))

export default function Home(){
  const [searchParams] = useSearchParams();
  const updateLecturerGmail = uselecturer((state) => state.setLecturerGmail);
  useEffect(() => {
    updateLecturerGmail(searchParams.get("lecturerGmail")??"");
  },[])
  const lecturerGmail = uselecturer((state) => state.lecturerGmail);
  return(
    <div>{`Hello ${lecturerGmail}`}</div>
  )
}