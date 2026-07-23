import { Button } from "~/components/ui/button";
import Logo from "~/assets/Logo.png";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { authAPI } from "~/lib/api";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [studentRegAllowed, setStudentRegAllowed] = useState(true);

  useEffect(() => {
    // Check if system needs initial setup (also returns allowed domains)
    authAPI.checkSetup().then((res) => {
      setNeedsSetup(res.data.needsSetup);
      setAllowedDomains(res.data.allowedDomains || []);
      setStudentRegAllowed(res.data.studentRegistrationAllowed !== false);
    }).catch(() => {
      setNeedsSetup(false);
    });

    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_email") {
      setError(
        "Invalid email! Please use an email ending with @student.tdtu.edu.vn or @tdtu.edu.vn.",
      );
    } else if (errorParam === "server_error") {
      setError("Server error! Please try again later.");
    } else if (errorParam === "lecturer_not_found") {
      setError(
        "Lecturer account has not been created yet! Please contact the admin to be granted access.",
      );
    } else if (errorParam === "student_registration_disabled") {
      setError(
        "Student registration is currently disabled. Please contact the admin.",
      );
    }
  }, [searchParams]);

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-gray-50">
      <div className="flex flex-col gap-6 bg-white rounded-lg px-5 py-10 border max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="size-14 rounded-md">
            <img src={Logo} alt="Derit" className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 text-center">
              DERIT
            </h1>
            <p className="text-sm text-gray-500 text-center mt-1">
              Exam System
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {needsSetup && (
          <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg text-sm">
            <p className="font-medium text-green-800 mb-1">
              First time setup detected
            </p>
            <p className="text-green-700">
              The first user to login will become the Super Admin.
            </p>
          </div>
        )}

        <Button
          onClick={() => {
            window.open(
              (import.meta.env.DEV
                ? import.meta.env.VITE_DEV_BACKEND_URL
                : import.meta.env.VITE_BACKEND_URL) + "/auth/google",
              "_self",
            );
          }}
          title="Login with Google"
          className="w-fit mx-auto cursor-pointer rounded-lg ring-0! border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 bg-white text-gray-800 font-medium py-5 flex gap-3 items-center justify-center duration-200 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid"
            viewBox="0 0 256 262"
            className="w-5 h-5"
          >
            <path
              fill="#4285F4"
              d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
            />
            <path
              fill="#34A853"
              d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
            />
            <path
              fill="#FBBC05"
              d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
            />
            <path
              fill="#EB4335"
              d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
            />
          </svg>
          Login with Google
        </Button>

        {studentRegAllowed && allowedDomains.length > 0 && (
          <p className="font-medium text-sm text-gray-500 text-center flex items-center justify-center space-x-1">
            <p className="text-red-500 mr-1">*</p>
            Student: ***@{allowedDomains.join(" or ***@")}
          </p>
        )}
      </div>
    </div>
  );
}
