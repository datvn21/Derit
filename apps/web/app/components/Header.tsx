import { useStudent } from "~/stores/studentStore";
import Logo from "~/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import axios from "axios";
import { useNavigate } from "react-router";
export default function Header() {
  const studentID = useStudent((state) => state.studentID);
  const studentName = useStudent((state) => state.studentName);
  const studentAvatar = useStudent((state) => state.studentAvatar);
  let navigate = useNavigate();
  const logout = async () => {
    try {
      const res = await axios.get(
        (import.meta.env.DEV ? import.meta.env.VITE_DEV_BACKEND_URL: import.meta.env.VITE_BACKEND_URL)+ "/auth/logout",
      );
      if (res.status === 200) {
        navigate("/");
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="py-2 border-b border-sidebar-border">
      <div className="w-[95vw] mx-auto flex justify-between items-center">
        <Logo size="md" alt="Derit Logo" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex gap-2 items-center cursor-pointer">
              <div>{studentName}</div>
              <div className="max-w-10 max-h-10">
                <img
                  className="rounded-3xl"
                  src={studentAvatar}
                  alt="Student Avatar"
                />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border border-muted-foreground w-[5vw] rounded-sm p-1 cursor-pointer">
            <DropdownMenuItem>
              <div
                onClick={logout}
                className="p-2 text-center text-destructive hover:bg-destructive/10 duration-100"
              >
                Logout
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
