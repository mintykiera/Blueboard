import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, CheckSquare, Bell, Link as LinkIcon } from "lucide-react";

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Tasks",
    url: "/#tasks",
    icon: CheckSquare,
  },
  {
    title: "Announcements",
    url: "/#announcements",
    icon: Bell,
  },
  {
    title: "Block Links",
    url: "/#links",
    icon: LinkIcon,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r-2 border-ink bg-card text-foreground">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="marker mt-2 px-4 text-xl">Menu</SidebarGroupLabel>
          <SidebarGroupContent className="mt-4">
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  location.pathname === item.url || location.hash === item.url.replace("/", "");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-11 gap-3 rounded-none border-y-2 border-transparent px-6 text-base font-semibold hover:border-ink hover:bg-secondary hover:text-foreground active:bg-secondary ${
                        isActive
                          ? "border-ink bg-[var(--marker-blue)] text-white hover:bg-[var(--marker-blue)] hover:text-white"
                          : ""
                      }`}
                    >
                      <a href={item.url}>
                        <item.icon className="h-5 w-5" strokeWidth={2.5} />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
